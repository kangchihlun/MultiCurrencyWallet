import coininfo from 'coininfo'
import { getState } from 'redux/core'
import actions from 'redux/actions'
import config from 'app-config'
import constants from './constants'
import request from './request'
import BigNumber from 'bignumber.js'


const networkCoininfo = process.env.MAINNET
  ? coininfo.bitcoincash.main
  : coininfo.bitcoincash.test
const network = networkCoininfo.toBitcoinJS()

const calculateTxSize = async ({ speed, unspents, address, txOut = 2, method = 'send', fixed } = {}) => {
  const defaultTxSize = constants.defaultFeeRates.bch.size[method]

  if (fixed) {
    return defaultTxSize
  }

  unspents = unspents || await actions.bch.fetchUnspents(address)

  const txIn = unspents.length

  const txSize = txIn > 0
    ? txIn * 146 + txOut * 33 + (15 + txIn - txOut)
    : defaultTxSize

  return txSize
}

const estimateFeeValue = async ({ feeRate, inSatoshis, speed, address, txSize, fixed, method } = {}) => {
  const DUST = 546
  const { user: { bchData } } = getState()

  address = address || bchData.address
  txSize = txSize || await calculateTxSize({ address, speed, fixed, method })
  feeRate = feeRate || await estimateFeeRate({ speed })

  const calculatedFeeValue = BigNumber.maximum(
    DUST,
    BigNumber(feeRate)
      .multipliedBy(txSize)
      .div(1024)
      .dp(0, BigNumber.ROUND_HALF_EVEN),
  )

  const finalFeeValue = inSatoshis
    ? calculatedFeeValue.toString()
    : calculatedFeeValue.multipliedBy(1e-8).toString()

  return finalFeeValue
}

const getTx = (txRaw) => {

  return false
}

const getLinkToInfo = (tx) => {
  if(!tx) {
    return
  }

  return `https://www.blockchain.com/ru/btc/tx/${tx}`
}

const estimateFeeRate = async ({ speed = 'fast' } = {}) => {
  const link = config.feeRates.bch
  const defaultRate = constants.defaultFeeRates.bch.rate

  if (!link) {
    return defaultRate[speed]
  }

  let apiResult

  try {
    apiResult = await request.get(link, { cacheResponse: 60000 })
  } catch (err) {
    console.error(`EstimateFeeRate: ${err.message}`)
    return defaultRate[speed]
  }

  const apiSpeeds = {
    slow: 'low_fee_per_kb',
    normal: 'medium_fee_per_kb',
    fast: 'high_fee_per_kb',
  }

  const apiSpeed = apiSpeeds[speed] || apiSpeed.normal

  const apiRate = BigNumber(apiResult[apiSpeed])

  return apiRate.isGreaterThanOrEqualTo(defaultRate.slow)
    ? apiRate.toString()
    : defaultRate[speed]
}

export default {
  calculateTxSize,
  estimateFeeValue,
  estimateFeeRate,
  network,
  getTx,
  getLinkToInfo
}
