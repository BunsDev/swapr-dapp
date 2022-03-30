import { BigNumber, Contract, ethers, utils } from 'ethers'
import { Provider } from '@ethersproject/abstract-provider'
import { ChainId } from '@swapr/sdk'
import { TokenWithAddressAndChain } from './GnosisBridge.types'
import { BRIDGE_CONFIG, OVERRIDES } from './GnosisBridge.config'
import { EcoBridgeProviders } from '../EcoBridge.types'

const ADDRESS_ZERO = ethers.constants.AddressZero

//overrides
const isOverridden = (bridgeDirection: string, token: TokenWithAddressAndChain) => {
  if (!token || !bridgeDirection) return false

  const { address, chainId } = token

  if (!address || !chainId) return false

  const overrides = OVERRIDES[bridgeDirection]
  const override = overrides[token.address.toLowerCase()]

  return override !== undefined && override[chainId] !== undefined
}

const getOverriddenMode = (bridgeDirection: string, token: TokenWithAddressAndChain): string | undefined => {
  if (!token || !bridgeDirection) return

  const { address, chainId } = token

  if (!address || !chainId) return

  const overrides = OVERRIDES[bridgeDirection]

  return overrides[address.toLowerCase()][chainId].mode
}

const getOverriddenMediator = (bridgeDirection: string, token: TokenWithAddressAndChain) => {
  if (!token || !bridgeDirection) return

  const { address, chainId } = token

  if (!address || !chainId) return

  const overrides = OVERRIDES[bridgeDirection]

  return overrides[token.address.toLowerCase()][chainId].mediator.toLowerCase()
}

const getMediatorAddressWithoutOverride = (bridgeDirection: string, chainId: ChainId) => {
  if (!bridgeDirection || !chainId) return

  const { homeChainId, homeMediatorAddress, foreignMediatorAddress } = BRIDGE_CONFIG[bridgeDirection]

  return homeChainId === chainId ? homeMediatorAddress.toLowerCase() : foreignMediatorAddress.toLowerCase()
}

export const getOverriddenToToken = (bridgeDirection: string, token: TokenWithAddressAndChain) => {
  if (!token || !bridgeDirection) return

  const { address, chainId } = token

  if (!address || !chainId) return

  const overrides = OVERRIDES[bridgeDirection]

  return overrides[address.toLowerCase()][chainId].to
}

//get mode
export const fetchMode = async (
  bridgeDirection: string,
  token: TokenWithAddressAndChain,
  provider?: Provider
): Promise<string | undefined> => {
  if (!provider) return

  if (isOverridden(bridgeDirection, token)) {
    return getOverriddenMode(bridgeDirection, token)
  }
  const { enableReversedBridge, homeChainId } = BRIDGE_CONFIG[bridgeDirection]

  if (!enableReversedBridge) {
    return token.chainId === homeChainId ? 'erc677' : 'erc20'
  }

  const { chainId, address } = token
  const mediatorAddress = getMediatorAddressWithoutOverride(bridgeDirection, chainId)

  const abi = ['function nativeTokenAddress(address) view returns (address)']

  if (!mediatorAddress) return

  const mediatorContract = new Contract(mediatorAddress, abi, provider)
  const nativeTokenAddress = await mediatorContract.nativeTokenAddress(address)

  if (nativeTokenAddress === ADDRESS_ZERO) return 'erc20'

  return 'erc677'
}

//get name

export const fetchTokenName = async (token: TokenWithAddressAndChain & { name: string }, provider?: Provider) => {
  let tokenName = token.name || ''

  try {
    const stringAbi = ['function name() view returns (string)']
    const tokenContractString = new Contract(token.address, stringAbi, provider)
    tokenName = await tokenContractString.name()
  } catch {
    const bytes32Abi = ['function name() view returns (bytes32)']
    const tokenContractBytes32 = new Contract(token.address, bytes32Abi, provider)
    tokenName = utils.parseBytes32String(await tokenContractBytes32.name())
  }
  return tokenName
}

const getToName = async (
  fromToken: TokenWithAddressAndChain & { name: string },
  toChainId: ChainId,
  toAddress: string,
  provider?: Provider
) => {
  const { name } = fromToken
  if (toAddress === ADDRESS_ZERO) {
    const fromName = name || (await fetchTokenName(fromToken))
    return fromName
  }

  return fetchTokenName({ chainId: toChainId, address: toAddress, name }, provider)
}

//get mediator
export const getMediatorAddress = (bridgeDirection: string, token: TokenWithAddressAndChain) => {
  if (!token || !token.chainId || !token.address) return

  if (isOverridden(bridgeDirection, token)) {
    return getOverriddenMediator(bridgeDirection, token)
  }

  return getMediatorAddressWithoutOverride(bridgeDirection, token.chainId)
}

//fetch toToken details
const fetchTokenDetailsString = async (token: TokenWithAddressAndChain, provider?: Provider) => {
  const abi = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
  ]
  const tokenContract = new Contract(token.address, abi, provider)

  const [name, symbol, decimals] = await Promise.all<string, string, number>([
    tokenContract.name(),
    tokenContract.symbol(),
    tokenContract.decimals()
  ])

  return { name, symbol, decimals }
}

const fetchTokenDetailsBytes32 = async (token: TokenWithAddressAndChain, provider?: Provider) => {
  const abi = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (bytes32)',
    'function name() view returns (bytes32)'
  ]
  const tokenContract = new Contract(token.address, abi, provider)
  const [name, symbol, decimals] = await Promise.all<string, string, number>([
    tokenContract.name(),
    tokenContract.symbol(),
    tokenContract.decimals()
  ])
  return {
    name: utils.parseBytes32String(name),
    symbol: utils.parseBytes32String(symbol),
    decimals
  }
}

const fetchTokenDetailsFromContract = async (
  token: TokenWithAddressAndChain,
  provider?: Provider
): Promise<{ name: string; symbol: string; decimals: number }> => {
  let details = { name: '', symbol: '', decimals: 0 }
  try {
    details = await fetchTokenDetailsString(token, provider)
  } catch {
    details = await fetchTokenDetailsBytes32(token, provider)
  }
  return details
}

export const fetchTokenDetails = async (
  bridgeDirection: string,
  token: TokenWithAddressAndChain,
  provider?: Provider
) => {
  const mediatorAddress = getMediatorAddress(bridgeDirection, token)

  const [{ name, decimals, symbol }, mode] = await Promise.all([
    fetchTokenDetailsFromContract(token, provider),
    fetchMode(bridgeDirection, token, provider)
  ])

  return {
    ...token,
    name,
    symbol,
    decimals: Number(decimals),
    mode,
    mediator: mediatorAddress
  }
}

const fetchToTokenDetails = async (
  bridgeDirection: string,
  fromToken: TokenWithAddressAndChain & { mode: string; name: string },
  toChainId: ChainId,
  providers?: EcoBridgeProviders
) => {
  if (!providers) return

  const { address, chainId, mode } = fromToken

  if (isOverridden(bridgeDirection, { address, chainId })) {
    const overriddenToTokenAddress = getOverriddenToToken(bridgeDirection, { address, chainId })

    if (!overriddenToTokenAddress) return

    return fetchTokenDetails(
      bridgeDirection,
      { address: overriddenToTokenAddress, chainId: toChainId },
      providers[toChainId]
    )
  }

  const fromMediatorAddress = getMediatorAddressWithoutOverride(bridgeDirection, chainId)
  const toMediatorAddress = getMediatorAddressWithoutOverride(bridgeDirection, toChainId)

  const fromEthersProvider = providers[chainId]
  const toEthersProvider = providers[toChainId]

  if (address === ADDRESS_ZERO && mode === 'NATIVE') {
    const toAddress = '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1'
    return fetchTokenDetails(
      bridgeDirection,
      {
        address: toAddress,
        chainId: toChainId
      },
      toEthersProvider
    )
  }

  if (!fromMediatorAddress || !toMediatorAddress) return

  const abi = [
    'function isRegisteredAsNativeToken(address) view returns (bool)',
    'function bridgedTokenAddress(address) view returns (address)',
    'function nativeTokenAddress(address) view returns (address)'
  ]
  const fromMediatorContract = new Contract(fromMediatorAddress, abi, fromEthersProvider)
  const isNativeToken = await fromMediatorContract.isRegisteredAsNativeToken(address)

  if (isNativeToken) {
    const toMediatorContract = new Contract(toMediatorAddress, abi, toEthersProvider)

    const toAddress = await toMediatorContract.bridgedTokenAddress(address)

    const toName = await getToName(fromToken, toChainId, toAddress, toEthersProvider)

    const abiDecimals = ['function decimals() view returns(uint)']
    const decimals = await new Contract(toAddress, abiDecimals, toEthersProvider).decimals()

    return {
      name: toName,
      chainId: toChainId,
      address: toAddress,
      mode: 'erc677',
      mediator: toMediatorAddress,
      decimals: decimals.toString()
    }
  }

  const toAddress = await fromMediatorContract.nativeTokenAddress(address)

  const toName = await getToName(fromToken, toChainId, toAddress, toEthersProvider)

  const abiDecimals = ['function decimals() view returns(uint)']
  const decimals = await new Contract(toAddress, abiDecimals, toEthersProvider).decimals()

  return {
    name: toName,
    chainId: toChainId,
    address: toAddress,
    mode: 'erc20',
    mediator: toMediatorAddress,
    decimals: decimals.toString()
  }
}

export const fetchToToken = async (
  bridgeDirection: string,
  fromToken: TokenWithAddressAndChain & { mode: string; name: string },
  toChainId: ChainId,
  providers?: EcoBridgeProviders
) => {
  const toToken = await fetchToTokenDetails(bridgeDirection, fromToken, toChainId, providers)

  return toToken
}

//calculate fee

const processMediatorData = async (
  direction: string,
  provider?: Provider
): Promise<{ feeManagerAddress: string; currentDay: BigNumber } | undefined> => {
  const abi = [
    'function getCurrentDay() view returns (uint256)',
    'function feeManager() public view returns (address)',
    'function getBridgeInterfacesVersion() external pure returns (uint64, uint64, uint64)'
  ]

  const { homeMediatorAddress } = BRIDGE_CONFIG[direction]

  const mediatorContract = new Contract(homeMediatorAddress, abi, provider)

  const [interfaceVersion, currentDay] = await Promise.all<BigNumber[], BigNumber>([
    mediatorContract.getBridgeInterfacesVersion(),
    mediatorContract.getCurrentDay()
  ])

  if (!interfaceVersion || !currentDay) return

  const version = interfaceVersion.map(v => v.toNumber()).join('.')

  if (version >= '2.1.0') {
    return { feeManagerAddress: await mediatorContract.feeManager(), currentDay }
  } else {
    return { feeManagerAddress: homeMediatorAddress, currentDay }
  }
}

export const checkRewardAddress = async (
  feeManagerAddress: string,
  account: string,
  provider?: Provider
): Promise<boolean> => {
  const abi = ['function isRewardAddress(address) view returns (bool)']
  const feeManagerContract = new Contract(feeManagerAddress, abi, provider)

  return await feeManagerContract.isRewardAddress(account)
}

export const calculateFees = async (direction: string, provider?: Provider) => {
  if (!provider) return

  const abi = [
    'function FOREIGN_TO_HOME_FEE() view returns (bytes32)',
    'function HOME_TO_FOREIGN_FEE() view returns (bytes32)'
  ]

  const mediatorData = await processMediatorData(direction, provider)

  if (!mediatorData) return

  const { feeManagerAddress } = mediatorData

  const feeManagerContract = new Contract(feeManagerAddress, abi, provider)

  const [foreignToHomeFee, homeToForeignFee] = await Promise.all<string, string>([
    feeManagerContract.FOREIGN_TO_HOME_FEE(),
    feeManagerContract.HOME_TO_FOREIGN_FEE()
  ])

  return { foreignToHomeFee, homeToForeignFee, feeManagerAddress }
}

export const fetchToAmount = async (
  direction: string,
  feeType: string,
  fromToken: TokenWithAddressAndChain & { name: string; mode: string; mediator: string },
  toToken: TokenWithAddressAndChain & { name: string; mode: string; mediator: string },
  fromAmount: BigNumber,
  feeManagerAddress: string,
  provider?: Provider
) => {
  if (fromAmount.lte(0) || !fromToken || !toToken) return BigNumber.from(0)

  const { homeChainId, homeMediatorAddress } = BRIDGE_CONFIG[direction]

  const isHome = homeChainId === toToken.chainId
  const tokenAddress = isHome ? toToken.address : fromToken.address
  const mediatorAddress = isHome ? toToken.mediator : fromToken.mediator

  if (mediatorAddress !== homeMediatorAddress) {
    return fromAmount
  }

  try {
    const abi = ['function calculateFee(bytes32, address, uint256) view returns (uint256)']
    const feeManagerContract = new Contract(feeManagerAddress, abi, provider)

    const fee = await feeManagerContract.calculateFee(feeType, tokenAddress, fromAmount)

    return fromAmount.sub(fee)
  } catch (amountError) {
    return fromAmount
  }
}
