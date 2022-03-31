import { parseUnits } from '@ethersproject/units'
import { ChainId, Currency } from '@swapr/sdk'
import { BigNumber, ethers } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'
import {
  EcoBridgeChangeHandler,
  EcoBridgeChildBaseConstructor,
  EcoBridgeChildBaseInit,
  OmniBridgeList
} from '../EcoBridge.types'
import { EcoBridgeChildBase } from '../EcoBridge.utils'
import {
  calculateFees,
  checkRewardAddress,
  fetchMode,
  fetchToAmount,
  fetchToToken,
  getMediatorAddress
} from './OmniBridge.utils'
import { omniBridgeActions } from './OmniBridge.reducers'

export class OmniBridge extends EcoBridgeChildBase {
  private _homeChainId: ChainId
  private _foreignChainId: ChainId

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
  }

  public onSignerChange = async (signerData: EcoBridgeChangeHandler) => {
    this.setSignerData(signerData)
  }

  public triggerBridging = () => undefined

  public approve = () => undefined

  public collect = () => undefined

  public validate = () => undefined

  public fetchDynamicLists = async () => undefined

  public fetchStaticLists = async () => undefined

  public getBridgingMetadata = async () => {
    try {
      if (!this._activeProvider || !this._staticProviders || !this._account) {
        this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'failed' }))
        return
      }

      const requestId = this.store.getState().ecoBridge[this.bridgeId as OmniBridgeList].lastMetadataCt

      const helperRequestId = (requestId ?? 0) + 1

      this.store.dispatch(this.actions.requestStarted({ id: helperRequestId }))

      this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'loading' }))

      const { address, chainId, name, value, decimals } = this.store.getState().ecoBridge.UI.from

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

      if (!feesData) return

      const { feeManagerAddress, foreignToHomeFee, homeToForeignFee } = feesData

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
            { address, chainId, name, mediator: fromTokenMediator, mode: fromTokenMode },
            {
              address: toToken.address,
              chainId: toToken.chainId,
              name: toToken.name,
              mediator: toToken.mediator ?? '',
              mode: toToken.mode ?? ''
            },
            parsedFromAmount,
            feeManagerAddress,
            this._staticProviders[this._homeChainId]
          )

      const feeAmount = parsedFromAmount.sub(toAmount)
      let fee = '0%'

      if (feeAmount.gt(0)) {
        fee = `${(
          (Number(parseUnits(feeAmount.toString(), toToken.decimals)) /
            Number(parseUnits(parsedFromAmount.toString(), toToken.decimals))) *
          100
        ).toString()}%`
      }

      const details = {
        fee,
        receiveAmount: formatUnits(toAmount.toString(), decimals),
        estimateTime: '2 min',
        requestId: helperRequestId
      }
      this.store.dispatch(this.actions.setBridgeDetails(details))
      this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'ready' }))
    } catch (e) {
      this.store.dispatch(this.actions.setBridgeDetailsStatus({ status: 'failed' }))
    }
  }

  public triggerModalDisclaimerText = () => undefined
}
