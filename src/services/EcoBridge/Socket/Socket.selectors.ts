import { createSelector } from 'reselect'

import { AppState } from '../../../state'
import { BridgeTransactionStatus, BridgeTransactionSummary } from '../../../state/bridgeTransactions/types'
import { SocketList } from '../EcoBridge.types'
import { SOCKET_PENDING_REASONS, SocketTx, SocketTxStatus } from './Socket.types'

const createSelectBridgingDetails = (bridgeId: SocketList) =>
  createSelector(
    [
      (state: AppState) => state.ecoBridge[bridgeId].bridgingDetails,
      (state: AppState) => state.ecoBridge[bridgeId].bridgingDetailsStatus,
      (state: AppState) => state.ecoBridge[bridgeId].bridgingDetailsErrorMessage,
    ],
    (details, loading, errorMessage) => {
      return {
        bridgeId,
        details,
        loading,
        errorMessage,
      }
    }
  )

const createSelectRoutes = (bridgeId: SocketList) =>
  createSelector([(state: AppState) => state.ecoBridge[bridgeId].routes], routes => routes)

const createSelectApprovalData = (bridgeId: SocketList) =>
  createSelector([(state: AppState) => state.ecoBridge[bridgeId].approvalData], approvalData => approvalData)

const createSelectTxBridgingData = (bridgeId: SocketList) =>
  createSelector([(state: AppState) => state.ecoBridge[bridgeId].txBridgingData], txBridgingData => txBridgingData)

const createSelectOwnedTransactions = (bridgeId: SocketList) =>
  createSelector(
    [
      (state: AppState) => state.ecoBridge[bridgeId].transactions,
      (state: AppState, account: string | undefined) => account,
    ],
    (txs, account) => {
      let ownedTxs: SocketTx[] = []

      if (account) {
        ownedTxs = txs.reduce<SocketTx[]>((filteredTxs, tx) => {
          if (account.toLocaleLowerCase() === tx.sender.toLocaleLowerCase()) {
            filteredTxs.push(tx)
          }

          return filteredTxs
        }, [])
      }

      return ownedTxs
    }
  )

const createSelectPendingTransactions = (selectOwnedTxs: ReturnType<typeof createSelectOwnedTransactions>) =>
  createSelector(selectOwnedTxs, ownedTxs => {
    const pendingTxs = ownedTxs.filter(tx => tx.status !== SocketTxStatus.ERROR && !tx.partnerTxHash)

    return pendingTxs
  })

const createSelectBridgeTransactionsSummary = (
  bridgeId: SocketList,
  selectOwnedTxs: ReturnType<typeof createSelectOwnedTransactions>
) =>
  createSelector([selectOwnedTxs], txs => {
    const summaries = txs.map(tx => {
      const pendingReason =
        tx.status === SocketTxStatus.FROM_PENDING
          ? SOCKET_PENDING_REASONS.FROM_PENDING
          : tx.status === SocketTxStatus.TO_PENDING
          ? SOCKET_PENDING_REASONS.TO_PENDING
          : undefined

      const fromValue = Number(tx.fromValue).toString()
      const toValue = Number(tx.toValue ?? 0).toString()

      const summary: BridgeTransactionSummary = {
        assetName: tx.assetName,
        assetAddressL1: tx.assetAddressL1,
        assetAddressL2: tx.assetAddressL2,
        fromChainId: tx.fromChainId,
        toChainId: tx.toChainId,
        status: tx.partnerTxHash
          ? BridgeTransactionStatus.CONFIRMED
          : tx.status === SocketTxStatus.ERROR
          ? BridgeTransactionStatus.FAILED
          : BridgeTransactionStatus.PENDING,
        fromValue,
        toValue,
        txHash: tx.txHash,
        pendingReason,
        timestampResolved: tx.timestampResolved,
        log: [
          {
            chainId: tx.fromChainId,
            txHash: tx.txHash,
          },
        ],
        bridgeId,
      }

      if (tx.partnerTxHash) {
        summary.log.push({
          chainId: tx.toChainId,
          txHash: tx.partnerTxHash,
        })
      }

      return summary
    })

    return summaries
  })

export interface SocketBridgeSelectors {
  selectBridgingDetails: ReturnType<typeof createSelectBridgingDetails>
  selectRoutes: ReturnType<typeof createSelectRoutes>
  selectApprovalData: ReturnType<typeof createSelectApprovalData>
  selectTxBridgingData: ReturnType<typeof createSelectTxBridgingData>
  selectOwnedTransactions: ReturnType<typeof createSelectOwnedTransactions>
  selectPendingTransactions: ReturnType<typeof createSelectPendingTransactions>
  selectBridgeTransactionsSummary: ReturnType<typeof createSelectBridgeTransactionsSummary>
}
export const socketSelectorsFactory = (socketBridges: SocketList[]) => {
  return socketBridges.reduce((total, bridgeId) => {
    const selectOwnedTransactions = createSelectOwnedTransactions(bridgeId)
    const selectBridgingDetails = createSelectBridgingDetails(bridgeId)
    const selectRoutes = createSelectRoutes(bridgeId)
    const selectApprovalData = createSelectApprovalData(bridgeId)
    const selectTxBridgingData = createSelectTxBridgingData(bridgeId)
    const selectPendingTransactions = createSelectPendingTransactions(selectOwnedTransactions)
    const selectBridgeTransactionsSummary = createSelectBridgeTransactionsSummary(bridgeId, selectOwnedTransactions)

    const selectors = {
      selectBridgingDetails,
      selectRoutes,
      selectApprovalData,
      selectTxBridgingData,
      selectOwnedTransactions,
      selectPendingTransactions,
      selectBridgeTransactionsSummary,
    }

    total[bridgeId] = selectors
    return total
  }, {} as { [k in SocketList]: SocketBridgeSelectors })
}

export const socketSelectors = socketSelectorsFactory(['socket'])
