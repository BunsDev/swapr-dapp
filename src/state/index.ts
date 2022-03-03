import { configureStore } from '@reduxjs/toolkit'
import { save, load } from 'redux-localstorage-simple'

import application from './application/reducer'
import { updateVersion } from './global/actions'
import user from './user/reducer'
import transactions from './transactions/reducer'
import fees from './fees/reducer'
import swap from './swap/reducer'
import mint from './mint/reducer'
import burn from './burn/reducer'
import multicall from './multicall/reducer'
import multiChainLinks from './multi-chain-links/reducer'
import lists from './lists/reducer'
import bridge from './bridge/reducer'
import bridgeTransactions from './bridgeTransactions/reducer'
import omnibridge from '../services/Omnibridge/store/Omnibridge.reducer'
import { omnibridgePersistedKeys } from '../services/Omnibridge/Omnibridge.config'
const PERSISTED_KEYS: string[] = ['user', 'transactions', 'claim', 'bridgeTransactions', ...omnibridgePersistedKeys]

const persistenceNamespace = 'swapr'
const store = configureStore({
  reducer: {
    application,
    user,
    transactions,
    fees,
    swap,
    mint,
    burn,
    multicall,
    multiChainLinks,
    lists,
    bridge,
    bridgeTransactions,
    omnibridge
  },
  middleware: [
    save({
      states: PERSISTED_KEYS,
      namespace: persistenceNamespace
    })
  ],
  //TODO store socket
  preloadedState: load({ states: PERSISTED_KEYS, namespace: persistenceNamespace })
})

store.dispatch(updateVersion())

export default store

export type AppState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
