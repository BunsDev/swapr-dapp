import { createSelector } from '@reduxjs/toolkit'
import { AppState } from '../../../state'
import { OmniBridgeList } from '../EcoBridge.types'

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

export interface OmniBridgeSelectors {
  selectBridgingDetails: ReturnType<typeof createSelectBridgingDetails>
}

export const omniBridgeSelectorsFactory = (omniBridges: OmniBridgeList[]) => {
  return omniBridges.reduce(
    (total, bridgeId) => {
      const selectBridgingDetails = createSelectBridgingDetails(bridgeId)

      const selectors = {
        selectBridgingDetails
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
