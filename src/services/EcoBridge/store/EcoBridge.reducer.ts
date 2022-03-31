import { combineReducers } from '@reduxjs/toolkit'
import { arbitrumReducers } from '../Arbitrum/ArbitrumBridge.reducer'
import { socketReducers } from '../Socket/Socket.reducer'
import { omniBridgeReducers } from '../OmniBridge/OmniBridge.reducers'
import { reducer as UIReducer } from './UI.reducer'
import { reducer as commonReducer } from './Common.reducer'

const ecoBridgeReducer = combineReducers({
  UI: UIReducer,
  common: commonReducer,
  ...arbitrumReducers,
  ...socketReducers,
  ...omniBridgeReducers
})

export default ecoBridgeReducer
