import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ChainId } from '@swapr/sdk'
import { AsyncState, BridgeDetails, BridgingDetailsErrorMessage, GnosisList } from '../EcoBridge.types'
import { BridgeTxsSummary } from './GnosisBridge.types'
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

export const createGnosisSlice = (bridgeId: GnosisList) =>
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

const gnosisSlices = {
  'omnibridge:eth-xdai': createGnosisSlice('omnibridge:eth-xdai')
}

type GnosisReducers = { [k in keyof typeof gnosisSlices]: ReturnType<typeof createGnosisSlice>['reducer'] }

type GnosisActions = { [k in keyof typeof gnosisSlices]: ReturnType<typeof createGnosisSlice>['actions'] }

type GnosisSliceExtract = {
  gnosisReducers: GnosisReducers
  gnosisActions: GnosisActions
}

export const { gnosisReducers, gnosisActions } = (Object.keys(gnosisSlices) as Array<keyof typeof gnosisSlices>).reduce(
  (total, key) => {
    total.gnosisReducers[key] = gnosisSlices[key].reducer
    total.gnosisActions[key] = gnosisSlices[key].actions
    return total
  },
  { gnosisActions: {}, gnosisReducers: {} } as GnosisSliceExtract
)
