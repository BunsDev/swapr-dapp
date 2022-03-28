import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { CurrencyAmount } from '@swapr/sdk'
import { useDispatch, useSelector } from 'react-redux'
import { Tabs } from './Tabs'
import AppBody from '../AppBody'
import { AssetSelector } from './AssetsSelector'
import { RowBetween } from '../../components/Row'
import ArrowIcon from '../../assets/svg/arrow.svg'
import { BridgeActionPanel } from './ActionPanel/BridgeActionPanel'
import { BridgeModal } from './BridgeModals/BridgeModal'
import { BridgeTransactionsSummary } from './BridgeTransactionsSummary'
import { BridgeTransactionSummary } from '../../state/bridgeTransactions/types'
import { NetworkSwitcher as NetworkSwitcherPopover, networkOptionsPreset } from '../../components/NetworkSwitcher'
import { useActiveWeb3React } from '../../hooks'
import { SHOW_TESTNETS } from '../../constants'
import { maxAmountSpend } from '../../utils/maxAmountSpend'
import { BridgeTabs, isNetworkDisabled } from './utils'
import { createNetworksList, getNetworkOptions } from '../../utils/networksList'
import { useEcoBridge } from '../../services/EcoBridge/EcoBridgeProvider'
import { AppState } from '../../state'
import { selectBridgeFilteredTransactions } from '../../services/EcoBridge/store/EcoBridge.selectors'
import { ecoBridgeUIActions } from '../../services/EcoBridge/store/UI.reducer'
import { BridgeSelectionWindow } from './BridgeSelectionWindow'
import CurrencyInputPanel from '../../components/CurrencyInputPanelBridge'
import { useBridgeModal } from './useBridgeModal'
import {
  useBridgeActionHandlers,
  useBridgeCollectHandlers,
  useBridgeFetchDynamicLists,
  useBridgeInfo,
  useBridgeListsLoadingStatus,
  useBridgeTxsFilter
} from '../../services/EcoBridge/EcoBridge.hooks'
import { BridgeModalStatus, BridgeTxsFilter } from '../../services/EcoBridge/EcoBridge.types'

const Wrapper = styled.div`
  width: 100%;
  max-width: 432px;
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

export default function Bridge() {
  const dispatch = useDispatch()
  const { chainId, account } = useActiveWeb3React()
  const ecoBridge = useEcoBridge()

  const bridgeSummaries = useSelector((state: AppState) =>
    selectBridgeFilteredTransactions(state, account ?? undefined)
  )

  useBridgeFetchDynamicLists()

  const { modalData, setModalData, setModalState } = useBridgeModal()
  const { bridgeCurrency, currencyBalance, parsedAmount, typedValue, fromChainId, toChainId } = useBridgeInfo()
  const {
    onCurrencySelection,
    onUserInput,
    onToNetworkChange,
    onFromNetworkChange,
    onSwapBridgeNetworks
  } = useBridgeActionHandlers()
  const { collectableTx, setCollectableTx, collecting, setCollecting, collectableCurrency } = useBridgeCollectHandlers()
  const listsLoading = useBridgeListsLoadingStatus()

  const [activeTab, setActiveTab] = useState<BridgeTabs>('bridge')

  const toPanelRef = useRef(null)
  const fromPanelRef = useRef(null)

  const [showToList, setShowToList] = useState(false)
  const [showFromList, setShowFromList] = useState(false)

  const setTxsFilter = useBridgeTxsFilter()

  const collectableTxAmount = bridgeSummaries.filter(tx => tx.status === 'redeem').length
  const isNetworkConnected = fromChainId === chainId
  const maxAmountInput: CurrencyAmount | undefined = maxAmountSpend(currencyBalance, chainId)
  const atMaxAmountInput = Boolean((maxAmountInput && parsedAmount?.equalTo(maxAmountInput)) || !isNetworkConnected)
  const { from, to } = useSelector((state: AppState) => state.ecoBridge.UI)

  const [displayedValue, setDisplayedValue] = useState('')

  //reset state
  useEffect(() => {
    //when user change chain we will get error because address of token isn't on the list (we have to fetch tokens again and then we can correct pair tokens)
    dispatch(ecoBridgeUIActions.setShowAvailableBridges(false))
    if (!collecting) {
      onUserInput('')
      setDisplayedValue('')
      onCurrencySelection('')
    }
  }, [from.chainId, to.chainId, dispatch, onCurrencySelection, collecting, onUserInput])

  useEffect(() => {
    dispatch(ecoBridgeUIActions.setFrom({ chainId }))
  }, [chainId, dispatch])

  const handleResetBridge = useCallback(() => {
    if (!chainId) return
    setDisplayedValue('')
    onUserInput('')
    onCurrencySelection('')

    setActiveTab('bridge')
    setTxsFilter(BridgeTxsFilter.RECENT)
    setModalState(BridgeModalStatus.CLOSED)
    if (collecting) {
      setCollecting(false)
    }
  }, [chainId, collecting, onCurrencySelection, onUserInput, setCollecting, setModalState, setTxsFilter])

  const handleMaxInput = useCallback(() => {
    maxAmountInput && onUserInput(isNetworkConnected ? maxAmountInput.toExact() : '')
  }, [maxAmountInput, isNetworkConnected, onUserInput])

  const handleSubmit = useCallback(async () => {
    if (!chainId) return

    await ecoBridge.triggerBridging()
  }, [chainId, ecoBridge])

  const handleModal = useCallback(async () => {
    ecoBridge.triggerModalDisclaimerText()

    setModalData({
      symbol: bridgeCurrency?.symbol,
      typedValue,
      fromChainId,
      toChainId
    })

    setModalState(BridgeModalStatus.DISCLAIMER)
  }, [ecoBridge, setModalData, bridgeCurrency, typedValue, fromChainId, toChainId, setModalState])

  const handleTriggerCollect = useCallback(
    (tx: BridgeTransactionSummary) => {
      if (!tx) return
      const { toChainId, value, assetName, fromChainId, txHash } = tx

      setCollectableTx(txHash)
      setCollecting(true)
      setActiveTab('collect')
      setTxsFilter(BridgeTxsFilter.COLLECTABLE)
      setModalData({ fromChainId, toChainId, symbol: assetName, typedValue: value })
    },
    [setCollectableTx, setCollecting, setModalData, setTxsFilter]
  )

  const handleCollect = useCallback(async () => {
    await ecoBridge.collect()
    setCollecting(false)
  }, [ecoBridge, setCollecting])

  const fromNetworkList = useMemo(
    () =>
      createNetworksList({
        networkOptionsPreset,
        isNetworkDisabled,
        onNetworkChange: onFromNetworkChange,
        selectedNetworkChainId: collecting && collectableTx ? collectableTx.fromChainId : fromChainId,
        activeChainId: !!account ? chainId : -1
      }),
    [account, chainId, collectableTx, collecting, fromChainId, onFromNetworkChange]
  )

  const toNetworkList = useMemo(
    () =>
      createNetworksList({
        networkOptionsPreset,
        isNetworkDisabled,
        onNetworkChange: onToNetworkChange,
        selectedNetworkChainId: collecting && collectableTx ? collectableTx.toChainId : toChainId,
        activeChainId: !!account ? chainId : -1
      }),
    [account, chainId, collectableTx, collecting, onToNetworkChange, toChainId]
  )

  return (
    <Wrapper>
      <Tabs
        collecting={collecting}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collectableTxAmount={collectableTxAmount}
        setTxsFilter={setTxsFilter}
        handleResetBridge={handleResetBridge}
        handleTriggerCollect={handleTriggerCollect}
        firstTxnToCollect={collectableTx}
      />
      {activeTab !== 'history' && (
        <AppBody>
          <RowBetween mb="12px">
            <Title>{collecting ? 'Collect' : 'Swapr Bridge'}</Title>
          </RowBetween>
          <Row mb="12px">
            <AssetWrapper ref={fromPanelRef}>
              <AssetSelector
                label="from"
                onClick={SHOW_TESTNETS ? () => setShowFromList(val => !val) : () => null}
                disabled={SHOW_TESTNETS ? collecting : true}
                networkOption={getNetworkOptions({
                  chainId: collecting && collectableTx ? collectableTx.fromChainId : fromChainId,
                  networkList: fromNetworkList
                })}
              />
              <NetworkSwitcherPopover
                networksList={fromNetworkList}
                showWalletConnector={false}
                parentRef={fromPanelRef}
                show={SHOW_TESTNETS ? showFromList : false}
                onOuterClick={SHOW_TESTNETS ? () => setShowFromList(false) : () => null}
                placement="bottom"
              />
            </AssetWrapper>
            <SwapButton onClick={onSwapBridgeNetworks} disabled={collecting}>
              <img src={ArrowIcon} alt="arrow" />
            </SwapButton>
            <AssetWrapper ref={toPanelRef}>
              <AssetSelector
                label="to"
                onClick={SHOW_TESTNETS ? () => setShowToList(val => !val) : () => null}
                disabled={SHOW_TESTNETS ? collecting : true}
                networkOption={getNetworkOptions({
                  chainId: collecting && collectableTx ? collectableTx.toChainId : toChainId,
                  networkList: toNetworkList
                })}
              />
              <NetworkSwitcherPopover
                networksList={toNetworkList}
                showWalletConnector={false}
                parentRef={toPanelRef}
                show={SHOW_TESTNETS ? showToList : false}
                onOuterClick={SHOW_TESTNETS ? () => setShowToList(false) : () => null}
                placement="bottom"
              />
            </AssetWrapper>
          </Row>
          <CurrencyInputPanel
            value={collecting && collectableTx ? collectableTx.value : typedValue}
            displayedValue={displayedValue}
            setDisplayedValue={setDisplayedValue}
            showMaxButton={!collecting && !atMaxAmountInput}
            currency={collecting ? collectableCurrency : bridgeCurrency}
            onUserInput={onUserInput}
            onMax={collecting ? undefined : handleMaxInput}
            onCurrencySelect={onCurrencySelection}
            disableCurrencySelect={!account || collecting || !isNetworkConnected}
            disabled={!account || collecting || !isNetworkConnected}
            id="bridge-currency-input"
            hideBalance={
              collecting && collectableTx
                ? ![collectableTx.fromChainId, collectableTx.toChainId].includes(chainId ?? 0)
                : false
            }
            isLoading={!!account && isNetworkConnected && listsLoading}
            chainIdOverride={collecting && collectableTx ? collectableTx.toChainId : undefined}
          />
          <BridgeActionPanel
            account={account}
            fromNetworkChainId={fromChainId}
            toNetworkChainId={collecting && collectableTx ? collectableTx.toChainId : toChainId}
            handleModal={handleModal}
            handleCollect={handleCollect}
            isNetworkConnected={isNetworkConnected}
            collecting={collecting}
            setCollecting={setCollecting}
          />
        </AppBody>
      )}
      {activeTab === 'bridge' && <BridgeSelectionWindow />}
      {!!bridgeSummaries.length && (
        <BridgeTransactionsSummary transactions={bridgeSummaries} handleTriggerCollect={handleTriggerCollect} />
      )}
      <BridgeModal
        handleResetBridge={handleResetBridge}
        setCollecting={setCollecting}
        setStatus={setModalState}
        modalData={modalData}
        handleSubmit={handleSubmit}
      />
    </Wrapper>
  )
}
