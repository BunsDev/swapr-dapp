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

const getTransactionStatus = (
  status: boolean | undefined | string,
  isClaimed: boolean,
  isFailed: boolean,
  hasSignatures: boolean
): BridgeTransactionStatus => {
  if (status === 'pending') {
    return 'pending'
  }

  if (!isClaimed) {
    return 'redeem'
  }

  if (isClaimed) {
    if (isFailed) {
      return 'failed'
    }
    if (hasSignatures) {
      return 'claimed'
    }
    return 'confirmed'
  }
  return 'loading'
}

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
