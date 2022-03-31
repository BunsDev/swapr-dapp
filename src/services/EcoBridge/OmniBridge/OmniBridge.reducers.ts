import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ChainId } from '@swapr/sdk'
import { AsyncState, BridgeDetails, BridgingDetailsErrorMessage, OmniBridgeList } from '../EcoBridge.types'
import { BridgeTxsSummary } from './OmniBridge.types'
import { TokenList } from '@uniswap/token-lists'
import { TransactionReceipt } from '@ethersproject/providers'

type InitialState = {
  transactions: { [txHash: string]: BridgeTxsSummary }
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
      addTransactions: (state, action: PayloadAction<BridgeTxsSummary[]>) => {
        action.payload.forEach(txn => {
          if (!txn.txHash) return

          const { txHash } = txn

          if (state.transactions[txHash]) return

          state.transactions[txHash] = {
            ...txn
          }
        })
      },
      addTx: (state, action: PayloadAction<BridgeTxsSummary>) => {
        const { payload: txn } = action

        if (!txn.txHash) return

        const { txHash } = txn

        if (state.transactions[txHash]) return

        state.transactions[txHash] = {
          ...txn
        }
      },
      updateTx: (state, action: PayloadAction<TransactionReceipt>) => {
        if (action.payload.status === 1) {
          state.transactions[action.payload.transactionHash].timestampResolved = Date.now()
          state.transactions[action.payload.transactionHash].receipt = action.payload
        }
      },
      updatePartnerTx: (
        state,
        action: PayloadAction<{
          txHash: string
          receivingTxHash: string
          toChainId: ChainId
          fromChainId: ChainId
          transactionDetails: {
            needsClaiming: boolean
            type?: string
          }
          message?: {
            messageData: string | null
            signatures: string[] | null
            messageId: string
          }
        }>
      ) => {
        const { payload: data } = action

        if (data.transactionDetails.needsClaiming && data.transactionDetails.type === 'withdraw') {
          state.transactions[data.txHash].status = 'redeem'
          state.transactions[data.txHash].message = data.message
        }

        if (!data.transactionDetails.needsClaiming) {
          if (data.transactionDetails.type === 'deposit') {
            state.transactions[action.payload.txHash].status = 'confirmed'
          } else {
            state.transactions[action.payload.txHash].status = 'claimed'
          }

          state.transactions[action.payload.txHash].log.push({
            txHash: action.payload.receivingTxHash,
            chainId: action.payload.toChainId
          })
        }
      },
      updateStatusBeforeCollecting: (state, action: PayloadAction<{ txHash: string }>) => {
        state.transactions[action.payload.txHash].status = 'pending'
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
