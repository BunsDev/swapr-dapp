import { BigNumber, Contract, ContractTransaction, ethers, Signer, utils } from 'ethers'
import { Provider } from '@ethersproject/abstract-provider'
import { ChainId } from '@swapr/sdk'
import { TokenWithAddressAndChain, Token, Request, Execution } from './OmniBridge.types'
import { BRIDGE_CONFIG, OVERRIDES } from './OmniBridge.config'
import { EcoBridgeProviders } from '../EcoBridge.types'
import { formatUnits } from 'ethers/lib/utils'

//constants
export const defaultTokensUrl: { [chainId: number]: string } = {
  100: 'https://tokens.honeyswap.org',
  1: 'https://tokens.uniswap.org'
}

export const nativeCurrencyMediators: { [chainId: number]: string } = {
  1: '0xa6439ca0fcba1d0f80df0be6a17220fed9c9038a'.toLowerCase()
}

const ADDRESS_ZERO = ethers.constants.AddressZero

//subgraph
export const getGraphEndpoint = (chainId: ChainId, direction: string) => {
  const name =
    chainId === BRIDGE_CONFIG[direction].homeChainId
      ? BRIDGE_CONFIG[direction].homeGraphName
      : BRIDGE_CONFIG[direction].foreignGraphName

  return `https://api.thegraph.com/subgraphs/name/${name}`
}

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
  try {
    return await fetchToTokenDetails(bridgeDirection, fromToken, toChainId, providers)
  } catch (e) {
    return
  }
}

//calculate fee and toAmount
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
  try {
    const abi = [
      'function FOREIGN_TO_HOME_FEE() view returns (bytes32)',
      'function HOME_TO_FOREIGN_FEE() view returns (bytes32)'
    ]

    const mediatorData = await processMediatorData(direction, provider)

    if (!mediatorData) return

    const { feeManagerAddress, currentDay } = mediatorData

    const feeManagerContract = new Contract(feeManagerAddress, abi, provider)

    const [foreignToHomeFee, homeToForeignFee] = await Promise.all<string, string>([
      feeManagerContract.FOREIGN_TO_HOME_FEE(),
      feeManagerContract.HOME_TO_FOREIGN_FEE()
    ])

    return { foreignToHomeFee, homeToForeignFee, feeManagerAddress, currentDay }
  } catch (e) {
    return
  }
}

export const fetchToAmount = async (
  direction: string,
  feeType: string,
  fromToken: TokenWithAddressAndChain & { name: string; mediator: string },
  toToken: TokenWithAddressAndChain & { name: string; mediator: string },
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
  } catch (e) {
    return fromAmount
  }
}

//allowance
export const fetchAllowance = async (
  { mediator, address }: { address: string; mediator?: string },
  account: string,
  provider?: Provider
): Promise<BigNumber | undefined> => {
  if (!account || !address || address === ADDRESS_ZERO || !mediator || mediator === ADDRESS_ZERO || !provider) return

  try {
    const abi = ['function allowance(address, address) view returns (uint256)']
    const tokenContract = new Contract(address, abi, provider)
    return tokenContract.allowance(account, mediator)
  } catch (e) {
    return
  }
}

export const approveToken = async (
  { address, mediator }: { address: string; mediator: string },
  amount: string,
  signer?: Signer
): Promise<ContractTransaction> => {
  const abi = ['function approve(address, uint256)']
  const tokenContract = new Contract(address, abi, signer)
  return tokenContract.approve(mediator, amount)
}

//tx limits
export const fetchTokenLimits = async (
  direction: string,
  token: Token,
  toToken: Token,
  currentDay: BigNumber,
  staticProviders: EcoBridgeProviders
) => {
  if (!token.mediator || !toToken.mediator) return

  const fromProvider = staticProviders[token.chainId]
  const toProvider = staticProviders[toToken.chainId]
  const isDedicatedMediatorToken = token.mediator !== getMediatorAddressWithoutOverride(direction, token.chainId)

  const abi = isDedicatedMediatorToken
    ? [
        'function minPerTx() view returns (uint256)',
        'function executionMaxPerTx() view returns (uint256)',
        'function executionDailyLimit() view returns (uint256)',
        'function totalExecutedPerDay(uint256) view returns (uint256)'
      ]
    : [
        'function minPerTx(address) view returns (uint256)',
        'function executionMaxPerTx(address) view returns (uint256)',
        'function executionDailyLimit(address) view returns (uint256)',
        'function totalExecutedPerDay(address, uint256) view returns (uint256)'
      ]

  try {
    const mediatorContract = new Contract(token.mediator, abi, fromProvider)
    const toMediatorContract = new Contract(toToken.mediator, abi, toProvider)

    const [minPerTx, executionMaxPerTx, executionDailyLimit, totalExecutedPerDay] = isDedicatedMediatorToken
      ? await Promise.all<BigNumber, BigNumber, BigNumber, BigNumber>([
          mediatorContract.minPerTx(),
          toMediatorContract.executionMaxPerTx(),
          mediatorContract.executionDailyLimit(),
          toMediatorContract.totalExecutedPerDay(currentDay)
        ])
      : await Promise.all<BigNumber, BigNumber, BigNumber, BigNumber>([
          mediatorContract.minPerTx(token.address),
          toMediatorContract.executionMaxPerTx(toToken.address),
          mediatorContract.executionDailyLimit(token.address),
          toMediatorContract.totalExecutedPerDay(toToken.address, currentDay)
        ])

    return {
      minPerTx,
      maxPerTx: executionMaxPerTx,
      dailyLimit: executionDailyLimit.sub(totalExecutedPerDay)
    }
  } catch (e) {
    return
  }
}

//transfer tokens
export const relayTokens = async (
  signer: Signer,
  token: { address: string; mode: string; mediator: string },
  receiver: string,
  amount: string,
  { shouldReceiveNativeCur, foreignChainId }: { shouldReceiveNativeCur: boolean; foreignChainId: ChainId }
): Promise<ContractTransaction> => {
  const { mode, mediator, address } = token

  const helperContractAddress = nativeCurrencyMediators[foreignChainId || 1]

  switch (mode) {
    case 'NATIVE': {
      const abi = ['function wrapAndRelayTokens(address _receiver) public payable']
      const helperContract = new Contract(helperContractAddress, abi, signer)
      return helperContract.wrapAndRelayTokens(receiver, { value: amount })
    }
    case 'erc677': {
      const abi = ['function transferAndCall(address, uint256, bytes)']
      const tokenContract = new Contract(address, abi, signer)
      const foreignHelperContract = nativeCurrencyMediators[foreignChainId || 1]
      const bytesData =
        shouldReceiveNativeCur && foreignHelperContract
          ? `${foreignHelperContract}${receiver.replace('0x', '')}`
          : receiver
      return tokenContract.transferAndCall(mediator, amount, bytesData)
    }
    case 'dedicated-erc20': {
      const abi = ['function relayTokens(address, uint256)']
      const mediatorContract = new Contract(mediator, abi, signer)
      return mediatorContract.relayTokens(receiver, amount)
    }
    case 'erc20':
    default: {
      const abi = ['function relayTokens(address, address, uint256)']
      const mediatorContract = new Contract(mediator, abi, signer)
      return mediatorContract.relayTokens(token.address, receiver, amount)
    }
  }
}

//txs history
export const combineTransactions = (
  requests: Request[],
  executions: Execution[],
  chainId: ChainId,
  bridgeChainId: ChainId
) =>
  requests.map(request => {
    const execution = executions.find(exec => exec.messageId === request.messageId)

    const { amount, txHash, symbol, timestamp, user, message, decimals } = request

    return {
      txHash,
      assetName: symbol,
      value: formatUnits(amount, decimals),
      fromChainId: chainId,
      toChainId: bridgeChainId,
      sender: user,
      timestampResolved: Number(timestamp),
      message,
      partnerTxHash: execution?.txHash,
      status: execution?.status
    }
  })
