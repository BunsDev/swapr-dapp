import { createSelector } from '@reduxjs/toolkit'
import { AppState } from '../../../state'
import { BridgeTransactionSummary } from '../../../state/bridgeTransactions/types'
import { OmniBridgeList } from '../EcoBridge.types'
import { OmniBridgeTxn } from './OmniBridge.types'
import { getTransactionStatus } from './OmniBridge.utils'

const createSelectBridgingDetails = (bridgeId: OmniBridgeList) =>
  createSelector(
    [
      (state: AppState) => state.ecoBridge[bridgeId].bridgingDetails,
      (state: AppState) => state.ecoBridge[bridgeId].bridgingDetailsStatus,
      (state: AppState) => state.ecoBridge[bridgeId].bridgingDetailsErrorMessage
    ],
    (details, loading, errorMessage) => {
      return {
        bridgeId,
        details,
        loading,
        errorMessage
      }
    }
  )

const createSelectOwnedTxs = (bridgeId: OmniBridgeList) =>
  createSelector(
    [
      (state: AppState) => state.ecoBridge[bridgeId].transactions,
      (state: AppState, account: string | undefined) => account
    ],
    (txs, account) => {
      let ownedTxs: OmniBridgeTxn[] = []

      if (account) {
        ownedTxs = Object.values(txs).reduce<OmniBridgeTxn[]>((totalTxs, tx) => {
          if (account.toLowerCase() === tx.sender.toLowerCase()) {
            totalTxs.push(tx)
          }

          return totalTxs
        }, [])
      }

      return ownedTxs
    }
  )

const createSelectBridgeTxsSummary = (
  bridgeId: OmniBridgeList,
  selectOwnedTxs: ReturnType<typeof createSelectOwnedTxs>
) =>
  createSelector([selectOwnedTxs], txs => {
    const summaries = txs.map(tx => {
      const { txHash, value, timestampResolved, assetName, fromChainId, toChainId, partnerTxHash, status, message } = tx

      const isClaimed = !!partnerTxHash
      const isFailed = !!partnerTxHash && status === false
      const hasSignatures = message && message.signatures && message.messageData ? true : false

      const transactionStatus = getTransactionStatus(status, isClaimed, isFailed, hasSignatures)

      const pendingReason = status === 'pending' ? 'Transaction has not been confirmed yet' : ''

      const summary: BridgeTransactionSummary = {
        txHash,
        assetName,
        value,
        fromChainId,
        toChainId,
        log: [{ chainId: fromChainId, txHash: txHash }],
        bridgeId,
        status: transactionStatus,
        pendingReason
      }

      if (partnerTxHash) {
        summary.log.push({ chainId: toChainId, txHash: partnerTxHash })
      }
      if (transactionStatus === 'claimed' || transactionStatus === 'confirmed') {
        summary.timestampResolved = timestampResolved
      }

      return summary
    })
    return summaries
  })

const createSelectPendingTransactions = (selectOwnedTxs: ReturnType<typeof createSelectOwnedTxs>) =>
  createSelector([selectOwnedTxs], txs => {
    return txs.filter(tx => tx.status === 'pending')
  })

export interface OmniBridgeSelectors {
  selectBridgingDetails: ReturnType<typeof createSelectBridgingDetails>
  selectOwnedTxs: ReturnType<typeof createSelectOwnedTxs>
  selectBridgeTxsSummary: ReturnType<typeof createSelectBridgeTxsSummary>
  selectPendingTxs: ReturnType<typeof createSelectPendingTransactions>
}

export const omniBridgeSelectorsFactory = (omniBridges: OmniBridgeList[]) => {
  return omniBridges.reduce(
    (total, bridgeId) => {
      const selectBridgingDetails = createSelectBridgingDetails(bridgeId)
      const selectOwnedTxs = createSelectOwnedTxs(bridgeId)
      const selectBridgeTxsSummary = createSelectBridgeTxsSummary(bridgeId, selectOwnedTxs)
      const selectPendingTxs = createSelectPendingTransactions(selectOwnedTxs)

      const selectors = {
        selectBridgingDetails,
        selectOwnedTxs,
        selectBridgeTxsSummary,
        selectPendingTxs
      }

      total[bridgeId] = selectors
      return total
    },
    {} as {
      [k in OmniBridgeList]: OmniBridgeSelectors
    }
  )
}

export const omniBridgeSelectors = omniBridgeSelectorsFactory(['omnibridge:eth-xdai'])
