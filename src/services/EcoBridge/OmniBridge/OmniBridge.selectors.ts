import { createSelector } from '@reduxjs/toolkit'
import { AppState } from '../../../state'
import { BridgeTransactionStatus, BridgeTransactionSummary } from '../../../state/bridgeTransactions/types'
import { OmniBridgeList } from '../EcoBridge.types'
import { OmniBridgeTxn } from './OmniBridge.types'

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

      const claimed = !!partnerTxHash
      const failed = !!partnerTxHash && status === false
      let transactionStatus: BridgeTransactionStatus = 'loading'

      if (status === undefined) transactionStatus = 'loading'

      if (claimed) {
        if (failed) {
          transactionStatus = 'failed'
        }
        transactionStatus = 'confirmed'

        if (message && message?.signatures && message.messageData) {
          transactionStatus = 'claimed'
        }
      }
      if (!claimed) {
        transactionStatus = 'redeem'
      }

      const summary: BridgeTransactionSummary = {
        txHash,
        assetName,
        value,
        fromChainId,
        toChainId,
        log: [{ chainId: fromChainId, txHash: txHash }],
        bridgeId,
        status: transactionStatus
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

export interface OmniBridgeSelectors {
  selectBridgingDetails: ReturnType<typeof createSelectBridgingDetails>
  selectOwnedTxs: ReturnType<typeof createSelectOwnedTxs>
  selectBridgeTxsSummary: ReturnType<typeof createSelectBridgeTxsSummary>
}

export const omniBridgeSelectorsFactory = (omniBridges: OmniBridgeList[]) => {
  return omniBridges.reduce(
    (total, bridgeId) => {
      const selectBridgingDetails = createSelectBridgingDetails(bridgeId)
      const selectOwnedTxs = createSelectOwnedTxs(bridgeId)
      const selectBridgeTxsSummary = createSelectBridgeTxsSummary(bridgeId, selectOwnedTxs)

      const selectors = {
        selectBridgingDetails,
        selectOwnedTxs,
        selectBridgeTxsSummary
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
