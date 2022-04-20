import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { SyncState, BridgeDetails, BridgingDetailsErrorMessage, OmniBridgeList } from '../EcoBridge.types'
import { OmniBridgeTxn, TransactionMessage } from './OmniBridge.types'
import { TokenList } from '@uniswap/token-lists'

type InitialState = {
  transactions: { [txHash: string]: OmniBridgeTxn }
  lists: { [id: string]: TokenList }
  listsStatus: SyncState
  bridgingDetails: BridgeDetails
  bridgingDetailsStatus: SyncState
  lastMetadataCt: number
  bridgingDetailsErrorMessage?: BridgingDetailsErrorMessage
}

const initialState: InitialState = {
  transactions: {},
  lists: {},
  listsStatus: SyncState.IDLE,
  bridgingDetails: {},
  bridgingDetailsStatus: SyncState.IDLE,
  lastMetadataCt: 0
}

export const createOmniBridgeSlice = (bridgeId: OmniBridgeList) =>
  createSlice({
    name: bridgeId,
    initialState,
    reducers: {
      addTransactions: (state, action: PayloadAction<OmniBridgeTxn[]>) => {
        action.payload.forEach(txn => {
          if (!txn.txHash) return

          const { txHash } = txn

          if (state.transactions[txHash]) return

          state.transactions[txHash] = {
            ...txn
          }
        })
      },
      addTx: (state, action: PayloadAction<OmniBridgeTxn>) => {
        const { payload: txn } = action

        if (!txn.txHash) return

        const { txHash } = txn

        if (state.transactions[txHash]) return

        state.transactions[txHash] = {
          ...txn
        }
      },
      updateTx: (state, action: PayloadAction<{ txHash: string; receipt: TransactionReceipt }>) => {
        const { receipt, txHash } = action.payload

        if (!state.transactions[txHash]) {
          throw Error('Transaction not found')
        }

        const txn = state.transactions[txHash]

        if (txn.receipt) return

        txn.receipt = receipt
        txn.timestampResolved = Date.now()

        state.transactions[txHash] = txn
      },
      setBridgeDetails: (state, action: PayloadAction<BridgeDetails>) => {
        const { gas, fee, estimateTime, receiveAmount, requestId } = action.payload

        //(store persist) crashing page without that code
        if (!state.bridgingDetails) {
          state.bridgingDetails = {}
        }

        if (requestId !== state.lastMetadataCt) {
          if (state.bridgingDetailsStatus === SyncState.FAILED) return
          state.bridgingDetailsStatus = SyncState.LOADING
          return
        } else {
          state.bridgingDetailsStatus = SyncState.READY
        }

        if (gas) {
          state.bridgingDetails.gas = gas
        }
        if (fee) {
          state.bridgingDetails.fee = fee
        }
        if (estimateTime) {
          state.bridgingDetails.estimateTime = estimateTime
        }
        if (receiveAmount) {
          state.bridgingDetails.receiveAmount = receiveAmount
        }
      },
      setBridgeDetailsStatus: (
        state,
        action: PayloadAction<{ status: SyncState; errorMessage?: BridgingDetailsErrorMessage }>
      ) => {
        const { status, errorMessage } = action.payload

        state.bridgingDetailsStatus = status

        if (errorMessage) {
          state.bridgingDetailsErrorMessage = errorMessage
        }
      },
      requestStarted: (state, action: PayloadAction<{ id: number }>) => {
        state.lastMetadataCt = action.payload.id
      },
      setTokenListsStatus: (state, action: PayloadAction<SyncState>) => {
        state.listsStatus = action.payload
      },
      addTokenLists: (state, action: PayloadAction<{ [id: string]: TokenList }>) => {
        const { payload } = action

        state.lists = payload
      },
      updatePartnerTransaction: (
        state,
        action: PayloadAction<{
          txHash?: string
          partnerTxHash?: string
          message?: TransactionMessage
          status?: string | boolean
        }>
      ) => {
        const { txHash, partnerTxHash, message, status } = action.payload
        if (!txHash) return

        if (partnerTxHash) {
          state.transactions[txHash].partnerTxHash = partnerTxHash
        }

        if (message) {
          state.transactions[txHash].message = message
        }
        if (status !== undefined) {
          state.transactions[txHash].status = status
        }
      }
    }
  })

const omniBridgeSlices = {
  'omnibridge:eth-xdai': createOmniBridgeSlice('omnibridge:eth-xdai')
}

type OmniBridgeReducers = { [k in keyof typeof omniBridgeSlices]: ReturnType<typeof createOmniBridgeSlice>['reducer'] }

type OmniBridgeActions = { [k in keyof typeof omniBridgeSlices]: ReturnType<typeof createOmniBridgeSlice>['actions'] }

type OmniBridgeSliceExtract = {
  omniBridgeReducers: OmniBridgeReducers
  omniBridgeActions: OmniBridgeActions
}

export const { omniBridgeReducers, omniBridgeActions } = (Object.keys(omniBridgeSlices) as Array<
  keyof typeof omniBridgeSlices
>).reduce(
  (total, key) => {
    total.omniBridgeReducers[key] = omniBridgeSlices[key].reducer
    total.omniBridgeActions[key] = omniBridgeSlices[key].actions
    return total
  },
  { omniBridgeReducers: {}, omniBridgeActions: {} } as OmniBridgeSliceExtract
)
