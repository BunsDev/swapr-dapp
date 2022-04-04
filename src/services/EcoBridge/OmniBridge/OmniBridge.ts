import { parseUnits } from '@ethersproject/units'
import { ChainId, Currency } from '@swapr/sdk'
import { BigNumber, ethers } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'
import {
  BridgeModalStatus,
  EcoBridgeChangeHandler,
  EcoBridgeChildBaseConstructor,
  EcoBridgeChildBaseInit,
  OmniBridgeList
} from '../EcoBridge.types'
import { EcoBridgeChildBase } from '../EcoBridge.utils'
import {
  approveToken,
  calculateFees,
  checkRewardAddress,
  combineTransactions,
  defaultTokensUrl,
  executeSignatures,
  fetchAllowance,
  fetchAmbVersion,
  fetchMode,
  fetchToAmount,
  fetchTokenLimits,
  fetchToToken,
  getGraphEndpoint,
  getMediatorAddress,
  getMessage,
  messageCallStatus,
  relayTokens,
  requiredSignatures
} from './OmniBridge.utils'
import { omniBridgeActions } from './OmniBridge.reducers'
import { foreignTokensQuery, homeTokensQuery } from './api/tokens'
import { request } from 'graphql-request'
import { BRIDGE_CONFIG } from './OmniBridge.config'
import { PairTokens, SubgraphExecutionsData, SubgraphRequestsData, SubgraphResponse } from './OmniBridge.types'
import { schema, TokenInfo, TokenList } from '@uniswap/token-lists'
import Ajv from 'ajv'
import { ecoBridgeUIActions } from '../store/UI.reducer'
import { executionsQuery, requestsUserQuery } from './api/history'
import { getErrorMsg } from '../Arbitrum/ArbitrumBridge.utils'

export class OmniBridge extends EcoBridgeChildBase {
  private _homeChainId: ChainId
  private _foreignChainId: ChainId

  private _tokensPair: PairTokens | undefined
  private _currentDay: BigNumber | undefined

  private get store() {
    if (!this._store) throw new Error('Gnosis: No store set')
    return this._store
  }

  private get actions() {
    return omniBridgeActions[this.bridgeId as OmniBridgeList]
  }

  constructor({ supportedChains: supportedChainsArr, bridgeId, displayName }: EcoBridgeChildBaseConstructor) {
    super({ supportedChains: supportedChainsArr, bridgeId, displayName })

    if (supportedChainsArr.length !== 1) throw new Error('Invalid config')

    const [supportedChains] = supportedChainsArr
    const { from, to } = supportedChains

    this._homeChainId = from
    this._foreignChainId = to
  }
  public init = async ({ account, activeChainId, activeProvider, staticProviders, store }: EcoBridgeChildBaseInit) => {
    this.setInitialEnv({ staticProviders, store })
    this.setSignerData({ account, activeChainId, activeProvider })

    await this._fetchHistory()
    //TODO pending listeners
  }

  public onSignerChange = async (signerData: EcoBridgeChangeHandler) => {
    this.setSignerData(signerData)
  }

  public triggerBridging = async () => {
    try {
      if (!this._account || !this._activeProvider || !this._tokensPair) return

      const { fromToken, toToken } = this._tokensPair
      const { address, mode, mediator, amount, chainId: fromChainId, decimals } = fromToken

      const { chainId: toChainId } = toToken

      if (!mode || !mediator || !toToken.mode) return

      let shouldReceiveNativeCur = false
      if (
        toToken.chainId === BRIDGE_CONFIG[this.bridgeId].foreignChainId &&
        toToken.address === ethers.constants.AddressZero &&
        toToken.mode === 'NATIVE'
      ) {
        shouldReceiveNativeCur = true
      }

      const isHome = this._activeChainId === this._homeChainId
      const claimDisabled = BRIDGE_CONFIG[this.bridgeId].claimDisabled
      const tokensClaimDisabled = BRIDGE_CONFIG[this.bridgeId].tokensClaimDisabled

      //check is withdraw
      const needsClaiming =
        isHome && !claimDisabled && !(tokensClaimDisabled || []).includes(fromToken.address.toLowerCase())

      this.store.dispatch(ecoBridgeUIActions.setBridgeModalStatus({ status: BridgeModalStatus.PENDING }))

      const tx = await relayTokens(
        this._activeProvider.getSigner(),
        { address, mode, mediator },
        this._account,
        amount.toString(),
        { shouldReceiveNativeCur, foreignChainId: this._foreignChainId }
      )

      this.store.dispatch(ecoBridgeUIActions.setBridgeModalStatus({ status: BridgeModalStatus.INITIATED }))

      this.store.dispatch(
        this.actions.addTx({
          assetName: fromToken.symbol ?? '',
          fromChainId,
          toChainId,
          sender: this._account,
          txHash: tx.hash,
          value: formatUnits(amount.toString(), decimals),
          needsClaiming,
          status: 'pending'
        })
      )

      const receipt = await tx.wait()

      if (receipt) {
        this.store.dispatch(this.actions.updateTx({ txHash: receipt.transactionHash, receipt }))
      }
    } catch (e) {
      this.store.dispatch(
        ecoBridgeUIActions.setBridgeModalStatus({ status: BridgeModalStatus.ERROR, error: getErrorMsg(e) })
      )
    }
  }

  public approve = async () => {
    if (!this._account || !this._activeProvider || !this._tokensPair) return

    const { fromToken } = this._tokensPair

    const { address, mediator, amount } = fromToken

    if (!mediator) return

    const tx = await approveToken({ address, mediator }, amount.toString(), this._activeProvider.getSigner())

    this.store.dispatch(
      ecoBridgeUIActions.setStatusButton({
        label: 'Approving',
        isError: false,
        isLoading: true,
        isBalanceSufficient: true,
        approved: false
      })
    )

    const receipt = await tx.wait()

    if (receipt) {
      this.store.dispatch(
        ecoBridgeUIActions.setStatusButton({
          label: 'Bridge',
          isError: false,
          isLoading: false,
          isBalanceSufficient: true,
          approved: true
        })
      )
    }
  }

  public collect = async () => {
    try {
      this.store.dispatch(ecoBridgeUIActions.setBridgeModalStatus({ status: BridgeModalStatus.PENDING }))

      const collectableTxHash = this.store.getState().ecoBridge.UI.collectableTxHash
      const transactions = this.store.getState().ecoBridge[this.bridgeId as OmniBridgeList].transactions

      if (!collectableTxHash) return

      const collectableTransaction = Object.values(transactions).find(tx => tx.txHash === collectableTxHash)

      if (!this._staticProviders) return

      const homeAmbAddress = BRIDGE_CONFIG[this.bridgeId].homeAmbAddress
      const foreignAmbAddress = BRIDGE_CONFIG[this.bridgeId].foreignAmbAddress

      const homeProvider = this._staticProviders[this._homeChainId]
      const foreignProvider = this._staticProviders[this._foreignChainId]

      if (!foreignProvider || !homeProvider || !collectableTransaction) return

      const { message, txHash } = collectableTransaction
      const homeRequiredSignatures = await requiredSignatures(homeAmbAddress, homeProvider)

      let txMessage =
        message && message.signatures && message.signatures.length >= homeRequiredSignatures ? message : null

      if (!txMessage) {
        const fetchedMessage = await getMessage(true, homeAmbAddress, txHash, homeProvider)
        txMessage = fetchedMessage
      }
      const isClaimed = await messageCallStatus(foreignAmbAddress, txMessage.messageId, foreignProvider)

      if (isClaimed || isClaimed !== undefined) return
      const { signatures, messageData } = txMessage

      if (!signatures || !messageData) return

      const foreignAmbVersion = await fetchAmbVersion(foreignAmbAddress, foreignProvider)

      const tx = await executeSignatures(
        foreignAmbAddress,
        foreignAmbVersion,
        {
          messageData,
          signatures
        },
        foreignProvider.getSigner()
      )
      this.store.dispatch(ecoBridgeUIActions.setBridgeModalStatus({ status: BridgeModalStatus.COLLECTING }))

      const receipt = tx.wait()

      if (receipt) {
        this.store.dispatch(ecoBridgeUIActions.setBridgeModalStatus({ status: BridgeModalStatus.SUCCESS }))
      }
    } catch (e) {
      this.store.dispatch(
        ecoBridgeUIActions.setBridgeModalStatus({ status: BridgeModalStatus.ERROR, error: getErrorMsg(e) })
      )
    }
  }

  public validate = async () => {
    if (!this._tokensPair || !this._staticProviders || !this._account || !this._currentDay) return

    this.store.dispatch(
      ecoBridgeUIActions.setStatusButton({
        label: 'Loading',
        isError: false,
        isLoading: true,
        isBalanceSufficient: false,
        approved: false
      })
    )

    const { fromToken, toToken } = this._tokensPair

    const limits = await fetchTokenLimits(this.bridgeId, fromToken, toToken, this._currentDay, this._staticProviders)

    if (!limits) return

    const { maxPerTx, minPerTx } = limits

    const { amount } = fromToken

    if (amount.lt(minPerTx)) {
      this.store.dispatch(
        ecoBridgeUIActions.setStatusButton({
          label: `Specify more than ${minPerTx.toString()}`,
          isError: false,
          isLoading: false,
          isBalanceSufficient: false,
          approved: false
        })
      )
      return
    }

    if (amount.gt(maxPerTx)) {
      this.store.dispatch(
        ecoBridgeUIActions.setStatusButton({
          label: `Specify less than ${maxPerTx.toString()}`,
          isError: false,
          isLoading: false,
          isBalanceSufficient: false,
          approved: false
        })
      )
      return
    }

    const allowance = await fetchAllowance(
      { address: fromToken.address, mediator: fromToken.mediator },
      this._account,
      this._staticProviders[fromToken.chainId]
    )

    if (!allowance || !fromToken.mode) {
      this.store.dispatch(
        ecoBridgeUIActions.setStatusButton({
          label: 'Cannot fetch allowance. Try later',
          isError: false,
          isLoading: false,
          isBalanceSufficient: false,
          approved: false
        })
      )
      return
    }

    if (['NATIVE', 'erc677'].includes(fromToken.mode) || allowance.gte(fromToken.amount)) {
      this.store.dispatch(
        ecoBridgeUIActions.setStatusButton({
          label: 'Bridge',
          isError: false,
          isLoading: false,
          isBalanceSufficient: true,
          approved: true
        })
      )
    } else {
      this.store.dispatch(
        ecoBridgeUIActions.setStatusButton({
          label: 'Approve',
          isError: false,
          isLoading: false,
          isBalanceSufficient: true,
          approved: false
        })
      )
    }
  }

  public fetchDynamicLists = async () => {
    try {
      if (!this._activeChainId) return

      const { from, to } = this.store.getState().ecoBridge.UI

      const selectedChains = [from.chainId, to.chainId]

      if (!(selectedChains.includes(this._foreignChainId) && selectedChains.includes(this._homeChainId))) {
        this.store.dispatch(this.actions.setTokenListsStatus('ready'))
        return
      }

      this.store.dispatch(this.actions.setTokenListsStatus('loading'))

      const homeEndpoint = getGraphEndpoint(from.chainId, this.bridgeId)
      const foreignEndpoint = getGraphEndpoint(to.chainId, this.bridgeId)

      const fetchDefaultTokens = async () => {
        const url = defaultTokensUrl[Number(from.chainId)]

        const tokenListValidator = new Ajv({ allErrors: true }).compile(schema)

        const response = await fetch(url)
        if (response.ok) {
          const json: TokenList = await response.json()
          if (tokenListValidator(json)) {
            return json.tokens.filter(token => token.chainId === from.chainId)
          }
        }
        return []
      }

      const [homeData, foreignData, defaultTokens] = await Promise.all<SubgraphResponse, SubgraphResponse, TokenInfo[]>(
        [request(homeEndpoint, homeTokensQuery), request(foreignEndpoint, foreignTokensQuery), fetchDefaultTokens()]
      )

      const homeTokens = homeData && homeData.tokens ? homeData.tokens : []
      const foreignTokens = foreignData && foreignData.tokens ? foreignData.tokens : []

      const allTokens = homeTokens.concat(foreignTokens, defaultTokens)

      const uniqueTokens = () => {
        const seen: { [address: string]: boolean } = {}
        return allTokens.reverse().filter(token => {
          const { address } = token
          const lowerCaseAddress = address.toLowerCase()
          const isDuplicate = Object.prototype.hasOwnProperty.call(seen, lowerCaseAddress)
            ? false
            : (seen[lowerCaseAddress] = true)
          return isDuplicate
        })
      }

      const tokens = uniqueTokens()

      const tokenList: TokenList = {
        name: 'OmniBridge',
        timestamp: new Date().toISOString(),
        version: {
          major: 1,
          minor: 0,
          patch: 0
        },
        tokens
      }

      this.store.dispatch(this.actions.addTokenLists({ 'omnibridge:eth-xdai': tokenList }))
      this.store.dispatch(this.actions.setTokenListsStatus('ready'))
    } catch (e) {
      this.store.dispatch(this.actions.setTokenListsStatus('failed'))
    }
  }

  public fetchStaticLists = async () => undefined

  public getBridgingMetadata = async () => {
    if (!this._activeProvider || !this._staticProviders || !this._account) {
      this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'failed' }))
      return
    }
    const { address, chainId, name, value, decimals, symbol } = this.store.getState().ecoBridge.UI.from

    if (Number(value) === 0) {
      this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'idle' }))
      return
    }

    const requestId = this.store.getState().ecoBridge[this.bridgeId as OmniBridgeList].lastMetadataCt

    const helperRequestId = (requestId ?? 0) + 1

    this.store.dispatch(this.actions.requestStarted({ id: helperRequestId }))

    this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'loading' }))

    if (address === Currency.getNative(this._homeChainId).symbol) {
      this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'failed' }))
      return
    }

    const fromTokenAddress =
      address === Currency.getNative(this._foreignChainId).symbol ? ethers.constants.AddressZero : address

    const fromTokenMode =
      fromTokenAddress === ethers.constants.AddressZero
        ? 'NATIVE'
        : await fetchMode(this.bridgeId, { address: fromTokenAddress, chainId }, this._staticProviders[chainId])

    const fromTokenMediator = getMediatorAddress(this.bridgeId, { address, chainId })

    if (!fromTokenMediator || !fromTokenMode || !name) {
      this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'failed' }))
      return
    }

    const toToken = await fetchToToken(
      this.bridgeId,
      { address: fromTokenAddress, chainId, mode: fromTokenMode, name },
      this._activeChainId === this._homeChainId ? this._foreignChainId : this._homeChainId,
      this._staticProviders
    )

    if (!toToken) {
      this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'failed' }))
      return
    }

    let parsedFromAmount = BigNumber.from(0)
    try {
      parsedFromAmount = parseUnits(value, decimals)
    } catch (e) {
      this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'failed' }))
      return
    }

    const feesData = await calculateFees(this.bridgeId, this._staticProviders[this._homeChainId])

    if (!feesData) {
      this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'failed' }))
      return
    }

    const { feeManagerAddress, foreignToHomeFee, homeToForeignFee, currentDay } = feesData

    this._currentDay = currentDay

    const isAddressReward = await checkRewardAddress(
      feeManagerAddress,
      this._account,
      this._staticProviders[this._homeChainId]
    )

    const feeType = this._activeChainId === this._homeChainId ? homeToForeignFee : foreignToHomeFee

    const toAmount = isAddressReward
      ? parsedFromAmount
      : await fetchToAmount(
          this.bridgeId,
          feeType,
          { address, chainId, name, mediator: fromTokenMediator },
          {
            address: toToken.address,
            chainId: toToken.chainId,
            name: toToken.name,
            mediator: toToken.mediator ?? ''
          },
          parsedFromAmount,
          feeManagerAddress,
          this._staticProviders[this._homeChainId]
        )

    const feeAmount = parsedFromAmount.sub(toAmount)

    let fee = '0%'

    if (feeAmount.gt(0)) {
      fee = `${(
        (Number(formatUnits(feeAmount.toString(), toToken.decimals)) /
          Number(formatUnits(parsedFromAmount.toString(), decimals))) *
        100
      ).toString()}%`
    }

    this._tokensPair = {
      fromToken: {
        address,
        chainId,
        name,
        mode: fromTokenMode,
        mediator: fromTokenMediator,
        decimals: decimals ?? 0,
        amount: parsedFromAmount,
        symbol
      },
      toToken: {
        address: toToken.address,
        chainId: toToken.chainId,
        name: toToken.name,
        decimals: toToken.decimals,
        mode: toToken.mode,
        mediator: toToken.mediator
      }
    }

    const details = {
      fee,
      receiveAmount: Number(formatUnits(toAmount.toString(), decimals)).toFixed(2),
      estimateTime: '2 min',
      requestId: helperRequestId
    }
    this.store.dispatch(this.actions.setBridgeDetails(details))
  }

  public triggerModalDisclaimerText = () => {
    const fromName = this._activeChainId === this._homeChainId ? 'Gnosis' : 'Mainnet'
    const toName = this._activeChainId !== this._foreignChainId ? 'Mainnet' : 'Gnosis'

    this.store.dispatch(
      ecoBridgeUIActions.setModalDisclaimerText(
        `Please confirm that you would like to send your funds from ${fromName} to ${toName}. `
      )
    )
  }

  private _fetchHistory = async () => {
    if (!this._account || !this._activeChainId) return

    //currently fetching data from testnet it will be removed
    const [{ requests: homeRequests }, { requests: foreignRequests }] = await Promise.all<
      SubgraphRequestsData,
      SubgraphRequestsData
    >([
      request(getGraphEndpoint(this._homeChainId, this.bridgeId), requestsUserQuery, {
        user: this._account
      }),
      request(getGraphEndpoint(this._foreignChainId, this.bridgeId), requestsUserQuery, {
        user: this._account
      })
    ])

    const homeRequestsIds = homeRequests.map(request => request.messageId)
    const foreignRequestsIds = foreignRequests.map(request => request.messageId)

    const [{ executions: homeExecutions }, { executions: foreignExecutions }] = await Promise.all<
      SubgraphExecutionsData,
      SubgraphExecutionsData
    >([
      request(getGraphEndpoint(this._homeChainId, this.bridgeId), executionsQuery, {
        messageIds: foreignRequestsIds
      }),
      request(getGraphEndpoint(this._foreignChainId, this.bridgeId), executionsQuery, {
        messageIds: homeRequestsIds
      })
    ])

    const homeTransfers = combineTransactions(homeRequests, foreignExecutions, this._homeChainId, this._foreignChainId)

    const foreignTransfers = combineTransactions(
      foreignRequests,
      homeExecutions,
      this._foreignChainId,
      this._homeChainId
    )

    this.store.dispatch(this.actions.addTransactions([...homeTransfers, ...foreignTransfers]))
  }
}
