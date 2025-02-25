import { ChainId, CurrencyAmount } from '@swapr/sdk'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'

import ArrowIcon from '../../assets/images/arrow.svg'
import { CurrencyInputPanelBridge } from '../../components/CurrencyInputPanel/CurrencyInputPanel.container'
import {
  networkOptionsPreset,
  NetworkSwitcher as NetworkSwitcherPopover,
  NetworkSwitcherTags,
} from '../../components/NetworkSwitcher'
import { PageMetaData } from '../../components/PageMetaData'
import { RowBetween } from '../../components/Row'
import { useActiveWeb3React } from '../../hooks'
import {
  useBridgeActionHandlers,
  useBridgeCollectHandlers,
  useBridgeFetchDynamicLists,
  useBridgeInfo,
  useBridgeListsLoadingStatus,
  useBridgeModal,
  useBridgeTxsFilter,
  useShowAvailableBridges,
} from '../../services/EcoBridge/EcoBridge.hooks'
import { BridgeModalStatus, BridgeTxsFilter } from '../../services/EcoBridge/EcoBridge.types'
import { useEcoBridge } from '../../services/EcoBridge/EcoBridgeProvider'
import {
  selectBridgeFilteredTransactions,
  selectSupportedBridges,
} from '../../services/EcoBridge/store/EcoBridge.selectors'
import { ecoBridgeUIActions } from '../../services/EcoBridge/store/UI.reducer'
import { AppState } from '../../state'
import { BridgeTransactionSummary } from '../../state/bridgeTransactions/types'
import { maxAmountSpend } from '../../utils/maxAmountSpend'
import { createNetworksList, getNetworkOptions } from '../../utils/networksList'
import AppBody from '../AppBody'
import { BridgeActionPanel } from './ActionPanel/BridgeActionPanel'
import { AssetSelector } from './AssetsSelector'
import { BridgeModal } from './BridgeModal/BridgeModal'
import { BridgeSelectionWindow } from './BridgeSelectionWindow'
import { BridgeTransactionsSummary } from './BridgeTransactionsSummary'
import { Tabs } from './Tabs'
import { BridgeTab, isNetworkDisabled } from './utils'

const Wrapper = styled.div`
  width: 100%;
  max-width: 457px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`

const Title = styled.p`
  margin: 0;
  font-weight: 500;
  font-size: 18px;
  line-height: 22px;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.purple2};
`

const Row = styled(RowBetween)`
  display: flex;
  flex-direction: row;
  box-sizing: border-box;
  align-items: stretch;
  justify-content: space-between;

  @media (max-width: 374px) {
    flex-direction: column;
  }
`

const SwapButton = styled.button<{ disabled: boolean }>`
  padding: 0 16px;
  border: none;
  background: none;
  cursor: ${({ disabled }) => (disabled ? 'auto' : 'pointer')};

  @media only screen and (max-width: 600px) {
    padding: 8px;
  }
`

const AssetWrapper = styled.div`
  flex: 1 0 35%;
`

const HistoryMessage = styled(Title)`
  font-size: 16px;
  font-weight: 300;
  margin: 5px;
`

const OutputPanelContainer = styled.div`
  margin-top: 12px;
`

/**
 * Checks if network is supported by the bridge.
 * Checks if the network exists in the defined presets.
 * Checks if the network has testnet or coming soon tag.
 * @param chainId
 */
export function isNetworkSupported(chainId: ChainId): boolean {
  const network = networkOptionsPreset.find(network => network.chainId === chainId)

  if (!network) {
    return false
  }

  // Check for tags
  return network.tag === NetworkSwitcherTags.COMING_SOON || network.tag === NetworkSwitcherTags.TESTNETS
}

export default function Bridge() {
  const dispatch = useDispatch()
  const { chainId, account } = useActiveWeb3React()
  const ecoBridge = useEcoBridge()

  const bridgeSummaries = useSelector((state: AppState) =>
    selectBridgeFilteredTransactions(state, account ?? undefined)
  )
  const possibleBridges = useSelector((state: AppState) => selectSupportedBridges(state))

  useBridgeFetchDynamicLists()

  const showAvailableBridges = useShowAvailableBridges()

  const { modalData, setModalData, setModalState } = useBridgeModal()
  const {
    bridgeCurrency,
    bridgeOutputCurrency,
    currencyBalance,
    typedValue,
    fromChainId,
    toChainId,
    isBridgeSwapActive,
    toValue,
  } = useBridgeInfo()
  const {
    onCurrencySelection,
    onCurrencyOutputSelection,
    onUserInput,
    onToNetworkChange,
    onFromNetworkChange,
    onSwapBridgeNetworks,
  } = useBridgeActionHandlers()
  const { collectableTx, setCollectableTx, isCollecting, setIsCollecting, collectableCurrency } =
    useBridgeCollectHandlers()
  const listsLoading = useBridgeListsLoadingStatus()

  const [activeTab, setActiveTab] = useState<BridgeTab>(isBridgeSwapActive ? BridgeTab.BRIDGE_SWAP : BridgeTab.BRIDGE)

  const toPanelRef = useRef(null)
  const fromPanelRef = useRef(null)

  const [showToList, setShowToList] = useState(false)
  const [showFromList, setShowFromList] = useState(false)

  const setTxsFilter = useBridgeTxsFilter()

  const collectableTxAmount = bridgeSummaries.filter(tx => tx.status === 'redeem').length
  const isNetworkConnected = fromChainId === chainId
  const hasBridges = possibleBridges.length > 0
  const maxAmountInput: CurrencyAmount | undefined = maxAmountSpend(currencyBalance, chainId)

  const [displayedValue, setDisplayedValue] = useState('')

  const isUnsupportedBridgeNetwork = !isNetworkSupported(chainId!)

  useEffect(() => {
    if (activeTab === BridgeTab.BRIDGE) {
      setTxsFilter(BridgeTxsFilter.RECENT)
    }
  }, [activeTab, setTxsFilter])

  useEffect(() => {
    if (!hasBridges) {
      dispatch(
        ecoBridgeUIActions.setStatusButton({
          label: 'Invalid Chain Pair',
          isError: false,
          isLoading: false,
          isBalanceSufficient: false,
          isApproved: false,
        })
      )
    }
  }, [dispatch, hasBridges])

  //reset state
  useEffect(() => {
    //when user change chain we will get error because address of token isn't on the list (we have to fetch tokens again and then we can correct pair tokens)
    dispatch(ecoBridgeUIActions.setShowAvailableBridges(false))
    if (!isCollecting) {
      onUserInput('')
      setDisplayedValue('')
      onCurrencySelection('')
      onCurrencyOutputSelection('')
    }
  }, [fromChainId, toChainId, dispatch, onCurrencySelection, isCollecting, onUserInput, onCurrencyOutputSelection])

  useEffect(() => {
    if (isUnsupportedBridgeNetwork) return

    dispatch(ecoBridgeUIActions.setFrom({ chainId }))
  }, [chainId, dispatch, isUnsupportedBridgeNetwork])

  const toggleBridgeSwap = (isActive: boolean) => {
    dispatch(ecoBridgeUIActions.setBridgeSwapStatus(isActive))
  }

  const handleResetBridge = useCallback(() => {
    if (!chainId) return

    onUserInput('')
    setDisplayedValue('')
    dispatch(ecoBridgeUIActions.setTo({ value: '' }))

    onCurrencySelection('')
    onCurrencyOutputSelection('')

    setTxsFilter(BridgeTxsFilter.RECENT)
    setModalState(BridgeModalStatus.CLOSED)

    if (isCollecting) {
      setIsCollecting(false)
      setActiveTab(BridgeTab.COLLECT)
    }
  }, [
    chainId,
    dispatch,
    isCollecting,
    onCurrencyOutputSelection,
    onCurrencySelection,
    onUserInput,
    setIsCollecting,
    setModalState,
    setTxsFilter,
  ])

  const handleMaxInput = useCallback(() => {
    maxAmountInput && onUserInput(isNetworkConnected ? maxAmountInput.toExact() : '')
    maxAmountInput && setDisplayedValue(isNetworkConnected ? maxAmountInput.toExact() : '')
  }, [maxAmountInput, isNetworkConnected, onUserInput])

  const handleSubmit = useCallback(async () => {
    if (!chainId) return

    await ecoBridge.triggerBridging()
  }, [chainId, ecoBridge])

  const handleModal = useCallback(async () => {
    setModalData({
      symbol: bridgeCurrency?.symbol,
      typedValue,
      fromChainId,
      toChainId,
    })

    setModalState(BridgeModalStatus.DISCLAIMER)
  }, [setModalData, bridgeCurrency, typedValue, fromChainId, toChainId, setModalState])

  const handleTriggerCollect = useCallback(
    (tx: BridgeTransactionSummary) => {
      if (!tx) return
      const { toChainId, fromValue, assetName, fromChainId, txHash } = tx

      setCollectableTx(txHash)
      setIsCollecting(true)
      setActiveTab(BridgeTab.COLLECT)
      setTxsFilter(BridgeTxsFilter.COLLECTABLE)
      setModalData({
        fromChainId,
        toChainId,
        symbol: assetName,
        typedValue: fromValue,
      })
    },
    [setCollectableTx, setIsCollecting, setModalData, setTxsFilter]
  )

  const handleCollect = useCallback(async () => {
    await ecoBridge.collect()
    setIsCollecting(false)
  }, [ecoBridge, setIsCollecting])

  const fromNetworkList = useMemo(
    () =>
      createNetworksList({
        networkOptionsPreset,
        isNetworkDisabled,
        onNetworkChange: onFromNetworkChange,
        selectedNetworkChainId: isCollecting && collectableTx ? collectableTx.fromChainId : fromChainId,
        activeChainId: account ? chainId : -1,
        showTestnets: false,
      }),
    [account, chainId, collectableTx, isCollecting, fromChainId, onFromNetworkChange]
  )

  const toNetworkList = useMemo(
    () =>
      createNetworksList({
        networkOptionsPreset,
        isNetworkDisabled,
        onNetworkChange: onToNetworkChange,
        selectedNetworkChainId: isCollecting && collectableTx ? collectableTx.toChainId : toChainId,
        activeChainId: account ? chainId : -1,
        showTestnets: false,
      }),
    [account, chainId, collectableTx, isCollecting, onToNetworkChange, toChainId]
  )

  return (
    <>
      <PageMetaData title="Bridge | Swapr" />
      <Wrapper>
        <Tabs
          isCollecting={isCollecting}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collectableTxAmount={collectableTxAmount}
          setTxsFilter={setTxsFilter}
          handleResetBridge={handleResetBridge}
          handleTriggerCollect={handleTriggerCollect}
          firstTxnToCollect={collectableTx}
          toggleBridgeSwap={toggleBridgeSwap}
        />
        {activeTab !== BridgeTab.HISTORY && (
          <AppBody>
            <RowBetween mb="12px">
              <Title>{isCollecting ? 'Collect' : 'Swapr Bridge'}</Title>
            </RowBetween>
            <Row mb="12px">
              <AssetWrapper ref={fromPanelRef}>
                <AssetSelector
                  label="from"
                  onClick={() => setShowFromList(val => !val)}
                  disabled={isCollecting}
                  networkOption={getNetworkOptions({
                    chainId: isCollecting && collectableTx ? collectableTx.fromChainId : fromChainId,
                    networkList: fromNetworkList,
                  })}
                />
                <NetworkSwitcherPopover
                  networksList={fromNetworkList}
                  showWalletConnector={false}
                  parentRef={fromPanelRef}
                  show={showFromList}
                  onOuterClick={() => setShowFromList(false)}
                  placement="bottom"
                />
              </AssetWrapper>
              <SwapButton onClick={onSwapBridgeNetworks} disabled={isCollecting}>
                <img src={ArrowIcon} alt="arrow" />
              </SwapButton>
              <AssetWrapper ref={toPanelRef}>
                <AssetSelector
                  label="to"
                  onClick={() => setShowToList(val => !val)}
                  disabled={isCollecting}
                  networkOption={getNetworkOptions({
                    chainId: isCollecting && collectableTx ? collectableTx.toChainId : toChainId,
                    networkList: toNetworkList,
                  })}
                />
                <NetworkSwitcherPopover
                  networksList={toNetworkList}
                  showWalletConnector={false}
                  parentRef={toPanelRef}
                  show={showToList}
                  onOuterClick={() => setShowToList(false)}
                  placement="bottom"
                />
              </AssetWrapper>
            </Row>
            <CurrencyInputPanelBridge
              value={isCollecting && collectableTx ? collectableTx.fromValue : typedValue}
              displayedValue={displayedValue}
              setDisplayedValue={setDisplayedValue}
              currency={isCollecting ? collectableCurrency : bridgeCurrency}
              onUserInput={onUserInput}
              onMax={isCollecting ? undefined : handleMaxInput}
              onCurrencySelect={onCurrencySelection}
              disableCurrencySelect={!account || isCollecting || !isNetworkConnected || !hasBridges}
              disabled={!account || isCollecting || !isNetworkConnected}
              id="bridge-currency-input"
              hideBalance={
                isCollecting && collectableTx
                  ? ![collectableTx.fromChainId, collectableTx.toChainId].includes(chainId ?? 0)
                  : false
              }
              isLoading={!!account && isNetworkConnected && listsLoading}
              chainIdOverride={isCollecting && collectableTx ? collectableTx.toChainId : undefined}
              maxAmount={maxAmountInput}
              isOutputPanel={false}
            />
            {activeTab === BridgeTab.BRIDGE_SWAP && (
              <OutputPanelContainer>
                <CurrencyInputPanelBridge
                  id="bridge-currency-output"
                  value={toValue}
                  onUserInput={onUserInput}
                  disabled={true}
                  currency={bridgeOutputCurrency}
                  onCurrencySelect={onCurrencyOutputSelection}
                  isOutputPanel={true}
                  disableCurrencySelect={!account || isCollecting || !isNetworkConnected || !hasBridges}
                  isLoading={!!account && isNetworkConnected && listsLoading}
                />
              </OutputPanelContainer>
            )}

            <BridgeActionPanel
              account={account}
              fromNetworkChainId={fromChainId}
              toNetworkChainId={isCollecting && collectableTx ? collectableTx.toChainId : toChainId}
              handleModal={handleModal}
              handleCollect={handleCollect}
              isNetworkConnected={isNetworkConnected}
              isCollecting={isCollecting}
              setIsCollecting={setIsCollecting}
            />
          </AppBody>
        )}
        {(activeTab === BridgeTab.BRIDGE || activeTab === BridgeTab.BRIDGE_SWAP) && showAvailableBridges && (
          <BridgeSelectionWindow />
        )}
        {!!bridgeSummaries.length && (
          <BridgeTransactionsSummary
            extraMargin={activeTab !== BridgeTab.HISTORY && !showAvailableBridges}
            transactions={bridgeSummaries}
            handleTriggerCollect={handleTriggerCollect}
          />
        )}
        {activeTab === BridgeTab.HISTORY && !bridgeSummaries.length && (
          <HistoryMessage>Your bridge transactions will appear here.</HistoryMessage>
        )}
        <BridgeModal
          handleResetBridge={handleResetBridge}
          setIsCollecting={setIsCollecting}
          setStatus={setModalState}
          modalData={modalData}
          handleSubmit={handleSubmit}
        />
      </Wrapper>
    </>
  )
}
