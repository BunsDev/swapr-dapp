import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { AsyncState, BridgeDetails, BridgingDetailsErrorMessage, OmniBridgeList } from '../EcoBridge.types'
import { OmniBridgeTxn } from './OmniBridge.types'
import { TokenList } from '@uniswap/token-lists'

type InitialState = {
  transactions: { [txHash: string]: OmniBridgeTxn }
  lists: { [id: string]: TokenList }
  listsStatus: AsyncState
  bridgingDetails: BridgeDetails
  bridgingDetailsStatus: AsyncState
  lastMetadataCt: number
  bridgingDetailsErrorMessage?: BridgingDetailsErrorMessage
}

const initialState: InitialState = {
  transactions: {},
  lists: {},
  listsStatus: 'idle',
  bridgingDetails: {},
  bridgingDetailsStatus: 'idle',
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
          if (state.bridgingDetailsStatus === 'failed') return
          state.bridgingDetailsStatus = 'loading'
          return
        } else {
          state.bridgingDetailsStatus = 'ready'
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
        action: PayloadAction<{ status: AsyncState; errorMessage?: BridgingDetailsErrorMessage }>
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
      setTokenListsStatus: (state, action: PayloadAction<AsyncState>) => {
        state.listsStatus = action.payload
      },
      addTokenLists: (state, action: PayloadAction<{ [id: string]: TokenList }>) => {
        const { payload } = action

        state.lists = payload
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
