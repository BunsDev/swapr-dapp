import { combineReducers } from '@reduxjs/toolkit'
import { arbitrumReducers } from '../Arbitrum/ArbitrumBridge.reducer'
import { socketReducers } from '../Socket/Socket.reducer'
import { gnosisReducers } from '../Gnosis/GnosisBridge.reducers'
import { reducer as UIReducer } from './UI.reducer'
import { reducer as commonReducer } from './Common.reducer'

const ecoBridgeReducer = combineReducers({
  UI: UIReducer,
  common: commonReducer,
  ...arbitrumReducers,
  ...socketReducers,
  ...gnosisReducers
})

export default ecoBridgeReducer
