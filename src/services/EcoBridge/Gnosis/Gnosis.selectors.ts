import { createSelector } from '@reduxjs/toolkit'
import { AppState } from '../../../state'
import { GnosisList } from '../EcoBridge.types'

const createSelectBridgingDetails = (bridgeId: GnosisList) =>
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

export interface GnosisBridgeSelectors {
  selectBridgingDetails: ReturnType<typeof createSelectBridgingDetails>
}

export const gnosisSelectorsFactory = (gnosisBridges: GnosisList[]) => {
  return gnosisBridges.reduce(
    (total, bridgeId) => {
      const selectBridgingDetails = createSelectBridgingDetails(bridgeId)

      const selectors = {
        selectBridgingDetails
      }

      total[bridgeId] = selectors
      return total
    },
    {} as {
      [k in GnosisList]: GnosisBridgeSelectors
    }
  )
}

export const gnosisSelectors = gnosisSelectorsFactory(['omnibridge:eth-xdai'])
