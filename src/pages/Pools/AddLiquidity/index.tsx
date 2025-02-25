import { BigNumber } from '@ethersproject/bignumber'
import { TransactionResponse } from '@ethersproject/providers'
import { ChainId, Currency, currencyEquals, JSBI, Percent, TokenAmount, UniswapV2RoutablePlatform } from '@swapr/sdk'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'react-feather'
import { useParams } from 'react-router-dom'
import { Text } from 'rebass'
import { useTheme } from 'styled-components'

import { ButtonPrimary } from '../../../components/Button'
import { BlueCard, OutlineCard } from '../../../components/Card'
import { AutoColumn, ColumnCenter } from '../../../components/Column'
import { CurrencyInputPanel } from '../../../components/CurrencyInputPanel'
import { DoubleCurrencyLogo } from '../../../components/DoubleCurrencyLogo'
import { PageMetaData } from '../../../components/PageMetaData'
import { PoolLiquidityHeader } from '../../../components/Pool/PoolLiquidityHeader'
import { MinimalPositionCard } from '../../../components/PositionCard'
import Row, { RowBetween, RowFlat } from '../../../components/Row'
import TradePrice from '../../../components/Swap/TradePrice'
import TransactionConfirmationModal, {
  ConfirmationModalContent,
} from '../../../components/TransactionConfirmationModal'
import { PairState } from '../../../data/Reserves'
import { useActiveWeb3React } from '../../../hooks'
import { useCurrency } from '../../../hooks/Tokens'
import { ApprovalState, useApproveCallback } from '../../../hooks/useApproveCallback'
import { useWrappingToken } from '../../../hooks/useContract'
import { useNativeCurrency } from '../../../hooks/useNativeCurrency'
import { useRouter } from '../../../hooks/useRouter'
import useTransactionDeadline from '../../../hooks/useTransactionDeadline'
import { useWalletSwitcherPopoverToggle } from '../../../state/application/hooks'
import { Field } from '../../../state/mint/actions'
import { useDerivedMintInfo, useMintActionHandlers, useMintState } from '../../../state/mint/hooks'
import { useTransactionAdder } from '../../../state/transactions/hooks'
import { useIsExpertMode, useUserSlippageTolerance } from '../../../state/user/hooks'
import { TYPE } from '../../../theme'
import { calculateGasMargin, calculateSlippageAmount, getRouterContract } from '../../../utils'
import { currencyId } from '../../../utils/currencyId'
import { maxAmountSpend } from '../../../utils/maxAmountSpend'
import { calculateProtocolFee } from '../../../utils/prices'
import { wrappedCurrency } from '../../../utils/wrappedCurrency'
import AppBody from '../../AppBody'
import { Dots, Wrapper } from '../styleds'
import { ConfirmAddModalBottom } from './ConfirmAddModalBottom'

type CurrencySearchParams = {
  currencyIdA: string
  currencyIdB: string
}

export default function AddLiquidity() {
  const { navigate, location } = useRouter()
  const { currencyIdA, currencyIdB } = useParams<CurrencySearchParams>()
  const { account, chainId, library } = useActiveWeb3React()
  const theme = useTheme()
  const nativeCurrency = useNativeCurrency()
  const nativeCurrencyWrapper = useWrappingToken(nativeCurrency)

  const currencyA = useCurrency(currencyIdA)
  const currencyB = useCurrency(currencyIdB)

  const oneCurrencyIsWrapped = Boolean(
    chainId &&
      nativeCurrencyWrapper &&
      ((currencyA && currencyEquals(currencyA, nativeCurrencyWrapper)) ||
        (currencyB && currencyEquals(currencyB, nativeCurrencyWrapper)))
  )

  const toggleWalletModal = useWalletSwitcherPopoverToggle() // toggle wallet when disconnected

  const expertMode = useIsExpertMode()

  // mint state
  const { independentField, typedValue, otherTypedValue } = useMintState()
  const {
    dependentField,
    currencies,
    pair,
    pairState,
    currencyBalances,
    parsedAmounts,
    price,
    noLiquidity,
    liquidityMinted,
    poolTokenPercentage,
    error,
  } = useDerivedMintInfo(currencyA ?? undefined, currencyB ?? undefined)
  const { onFieldAInput, onFieldBInput } = useMintActionHandlers(noLiquidity)

  const isValid = !error

  // modal and loading
  const [showConfirm, setShowConfirm] = useState<boolean>(false)
  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // clicked confirm

  // txn values
  const deadline = useTransactionDeadline() // custom from users settings
  const allowedSlippage = useUserSlippageTolerance() // custom from users
  const [txHash, setTxHash] = useState<string>('')
  const [invertedPrice, setInvertedPrice] = useState<boolean>(false)

  // get formatted amounts
  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]: noLiquidity ? otherTypedValue : parsedAmounts[dependentField]?.toSignificant(6) ?? '',
  }

  const { protocolFee } = calculateProtocolFee(pair, parsedAmounts[independentField])
  const swapFee = pair ? new Percent(JSBI.BigInt(pair.swapFee.toString()), JSBI.BigInt(10000)) : undefined

  // get the max amounts user can add
  const maxAmounts: { [field in Field]?: TokenAmount } = [Field.CURRENCY_A, Field.CURRENCY_B].reduce(
    (accumulator, field) => {
      return {
        ...accumulator,
        [field]: maxAmountSpend(currencyBalances[field], chainId),
      }
    },
    {}
  )

  // check whether the user has approved the router on the tokens
  const routerAddress = UniswapV2RoutablePlatform.SWAPR.routerAddress[chainId ? chainId : ChainId.MAINNET]
  const [approvalA, approveACallback] = useApproveCallback(parsedAmounts[Field.CURRENCY_A], routerAddress)
  const [approvalB, approveBCallback] = useApproveCallback(parsedAmounts[Field.CURRENCY_B], routerAddress)

  const addTransaction = useTransactionAdder()

  async function onAdd() {
    if (!chainId || !library || !account) return
    const router = getRouterContract(chainId, library, UniswapV2RoutablePlatform.SWAPR, account)

    const { [Field.CURRENCY_A]: parsedAmountA, [Field.CURRENCY_B]: parsedAmountB } = parsedAmounts
    if (!parsedAmountA || !parsedAmountB || !currencyA || !currencyB || !deadline) {
      return
    }

    const amountsMin = {
      [Field.CURRENCY_A]: calculateSlippageAmount(parsedAmountA, noLiquidity ? 0 : allowedSlippage)[0],
      [Field.CURRENCY_B]: calculateSlippageAmount(parsedAmountB, noLiquidity ? 0 : allowedSlippage)[0],
    }

    let estimate,
      method: (...args: any) => Promise<TransactionResponse>,
      args: Array<string | string[] | number>,
      value: BigNumber | null
    if (currencyA === nativeCurrency || currencyB === nativeCurrency) {
      const tokenBIsNative = currencyB === nativeCurrency
      estimate = router.estimateGas.addLiquidityETH
      method = router.addLiquidityETH
      args = [
        wrappedCurrency(tokenBIsNative ? currencyA : currencyB, chainId)?.address ?? '', // token
        (tokenBIsNative ? parsedAmountA : parsedAmountB).raw.toString(), // token desired
        amountsMin[tokenBIsNative ? Field.CURRENCY_A : Field.CURRENCY_B].toString(), // token min
        amountsMin[tokenBIsNative ? Field.CURRENCY_B : Field.CURRENCY_A].toString(), // eth min
        account,
        deadline.toHexString(),
      ]
      value = BigNumber.from((tokenBIsNative ? parsedAmountB : parsedAmountA).raw.toString())
    } else {
      estimate = router.estimateGas.addLiquidity
      method = router.addLiquidity
      args = [
        wrappedCurrency(currencyA, chainId)?.address ?? '',
        wrappedCurrency(currencyB, chainId)?.address ?? '',
        parsedAmountA.raw.toString(),
        parsedAmountB.raw.toString(),
        amountsMin[Field.CURRENCY_A].toString(),
        amountsMin[Field.CURRENCY_B].toString(),
        account,
        deadline.toHexString(),
      ]
      value = null
    }

    setAttemptingTxn(true)
    await estimate(...args, value ? { value } : {})
      .then(estimatedGasLimit =>
        method(...args, {
          ...(value ? { value } : {}),
          gasLimit: calculateGasMargin(estimatedGasLimit),
        }).then(response => {
          setAttemptingTxn(false)

          addTransaction(response, {
            summary:
              'Add ' +
              parsedAmounts[Field.CURRENCY_A]?.toSignificant(3) +
              ' ' +
              currencies[Field.CURRENCY_A]?.symbol +
              ' and ' +
              parsedAmounts[Field.CURRENCY_B]?.toSignificant(3) +
              ' ' +
              currencies[Field.CURRENCY_B]?.symbol,
          })

          setTxHash(response.hash)
        })
      )
      .catch(error => {
        setAttemptingTxn(false)
        // we only care if the error is something _other_ than the user rejected the tx
        if (error?.code !== 4001) {
          console.error(error)
        }
      })
  }

  const modalHeader = () => {
    return noLiquidity ? (
      <AutoColumn gap="20px">
        <OutlineCard mt="20px" borderRadius="8px">
          <RowFlat style={{ alignItems: 'center' }}>
            <DoubleCurrencyLogo
              marginRight={6}
              currency0={currencies[Field.CURRENCY_A]}
              currency1={currencies[Field.CURRENCY_B]}
              size={24}
            />
            <Text fontSize="26px" fontWeight={600} lineHeight="31px" marginLeft={10}>
              {currencies[Field.CURRENCY_A]?.symbol + '/' + currencies[Field.CURRENCY_B]?.symbol}
            </Text>
          </RowFlat>
        </OutlineCard>
      </AutoColumn>
    ) : (
      <AutoColumn gap="4px">
        <RowFlat style={{ marginTop: '12px', alignItems: 'center' }}>
          <Text fontSize="28px" fontWeight={600} lineHeight="42px" marginRight={10}>
            {liquidityMinted?.toSignificant(6)}
          </Text>
          <DoubleCurrencyLogo
            marginLeft={6}
            currency0={currencies[Field.CURRENCY_A]}
            currency1={currencies[Field.CURRENCY_B]}
            size={30}
          />
        </RowFlat>
        <Row>
          <Text fontSize="12px">
            {currencies[Field.CURRENCY_A]?.symbol + '/' + currencies[Field.CURRENCY_B]?.symbol + ' Pool Tokens'}
          </Text>
        </Row>
        <TYPE.Italic fontSize={12} textAlign="left" padding={'8px 0 0 0 '}>
          {`Output is estimated. If the price changes by more than ${
            allowedSlippage / 100
          }% your transaction will revert.`}
        </TYPE.Italic>
      </AutoColumn>
    )
  }

  const modalBottom = () => {
    return (
      <ConfirmAddModalBottom
        price={price}
        currencies={currencies}
        parsedAmounts={parsedAmounts}
        noLiquidity={noLiquidity}
        onAdd={onAdd}
        poolTokenPercentage={poolTokenPercentage}
      />
    )
  }

  const pendingText = `Supplying ${parsedAmounts[Field.CURRENCY_A]?.toSignificant(6)} ${
    currencies[Field.CURRENCY_A]?.symbol
  } and ${parsedAmounts[Field.CURRENCY_B]?.toSignificant(6)} ${currencies[Field.CURRENCY_B]?.symbol}`

  const handleCurrencyASelect = useCallback(
    (currencyA: Currency) => {
      const newCurrencyIdA = currencyId(currencyA)
      if (newCurrencyIdA === currencyIdB) {
        navigate(`/pools/add/${currencyIdB}/${currencyIdA}`)
      } else {
        navigate(`/pools/add/${newCurrencyIdA}/${currencyIdB}`)
      }
    },
    [currencyIdB, navigate, currencyIdA]
  )
  const handleCurrencyBSelect = useCallback(
    (currencyB: Currency) => {
      const newCurrencyIdB = currencyId(currencyB)
      if (currencyIdA === newCurrencyIdB) {
        if (currencyIdB) {
          navigate(`/pools/add/${currencyIdB}/${newCurrencyIdB}`)
        } else {
          navigate(`/pools/add/${newCurrencyIdB}`)
        }
      } else {
        navigate(`/pools/add/${currencyIdA ? currencyIdA : 'ETH'}/${newCurrencyIdB}`)
      }
    },
    [currencyIdA, navigate, currencyIdB]
  )

  const handleDismissConfirmation = useCallback(() => {
    setShowConfirm(false)
    // if there was a tx hash, we want to clear the input
    if (txHash) {
      onFieldAInput('')
      onFieldBInput('')
    }
    setTxHash('')
  }, [onFieldAInput, onFieldBInput, txHash])

  const isCreate = location.pathname.includes('/create')

  useEffect(() => {
    return function inputCleanup() {
      onFieldAInput('')
      onFieldBInput('')
    }
  }, [onFieldAInput, onFieldBInput])

  return (
    <>
      <PageMetaData title={`${isCreate ? 'Create a pair' : 'Add Liquidity'} | Swapr`} />
      <AppBody>
        <PoolLiquidityHeader creating={isCreate} adding={true} />
        <Wrapper>
          <TransactionConfirmationModal
            isOpen={showConfirm}
            onDismiss={handleDismissConfirmation}
            attemptingTxn={attemptingTxn}
            hash={txHash}
            content={() => (
              <ConfirmationModalContent
                title={noLiquidity ? 'You are creating a pool' : 'You will receive'}
                onDismiss={handleDismissConfirmation}
                topContent={modalHeader}
                bottomContent={modalBottom}
              />
            )}
            pendingText={pendingText}
          />
          <AutoColumn gap="20px">
            {noLiquidity ||
              (isCreate && (
                <ColumnCenter>
                  <BlueCard>
                    <AutoColumn gap="10px">
                      <TYPE.Link fontWeight={600} color={'primaryText1'}>
                        You are the first liquidity provider.
                      </TYPE.Link>
                      <TYPE.Link fontWeight={400} color={'primaryText1'}>
                        The ratio of tokens you add will set the price of this pool.
                      </TYPE.Link>
                      <TYPE.Link fontWeight={400} color={'primaryText1'}>
                        Once you are happy with the rate click supply to review.
                      </TYPE.Link>
                    </AutoColumn>
                  </BlueCard>
                </ColumnCenter>
              ))}
            <CurrencyInputPanel
              value={formattedAmounts[Field.CURRENCY_A]}
              onUserInput={onFieldAInput}
              onMax={() => {
                onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')
              }}
              onCurrencySelect={handleCurrencyASelect}
              currency={currencies[Field.CURRENCY_A]}
              maxAmount={maxAmounts[Field.CURRENCY_A]}
              id="add-liquidity-input-tokena"
              showCommonBases
            />
            <ColumnCenter>
              <Plus size="16" color={theme.text2} />
            </ColumnCenter>
            <CurrencyInputPanel
              value={formattedAmounts[Field.CURRENCY_B]}
              onUserInput={onFieldBInput}
              onCurrencySelect={handleCurrencyBSelect}
              onMax={() => {
                onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')
              }}
              currency={currencies[Field.CURRENCY_B]}
              maxAmount={maxAmounts[Field.CURRENCY_B]}
              id="add-liquidity-input-tokenb"
              showCommonBases
            />
            {currencies[Field.CURRENCY_A] && currencies[Field.CURRENCY_B] && pairState !== PairState.INVALID && (
              <AutoColumn gap="8px" style={{ padding: '0 16px' }}>
                <RowBetween align="center">
                  <TYPE.Body fontWeight="500" fontSize={12}>
                    Price
                  </TYPE.Body>
                  <TradePrice price={price} showInverted={invertedPrice} setShowInverted={setInvertedPrice} />
                </RowBetween>
                <RowBetween align="center">
                  <TYPE.Body fontWeight="500" fontSize={12}>
                    Pool&apos;s share
                  </TYPE.Body>
                  <TYPE.Body fontWeight="500" fontSize={12}>
                    {poolTokenPercentage ? `${poolTokenPercentage.toSignificant(2)}%` : '-'}
                  </TYPE.Body>
                </RowBetween>
                <RowBetween align="center">
                  <TYPE.Body fontWeight="500" fontSize={12}>
                    Swap fee
                  </TYPE.Body>
                  <TYPE.Body fontWeight="500" fontSize={12}>
                    {swapFee ? `${swapFee.toSignificant(2)}%` : '-'}
                  </TYPE.Body>
                </RowBetween>
                <RowBetween align="center">
                  <TYPE.Body fontWeight="500" fontSize={12}>
                    Protocol fee
                  </TYPE.Body>
                  <TYPE.Body fontWeight="500" fontSize={12}>
                    {protocolFee ? `${protocolFee.toSignificant(2)}%` : '-'}
                  </TYPE.Body>
                </RowBetween>
              </AutoColumn>
            )}

            {!account ? (
              <ButtonPrimary onClick={toggleWalletModal}>Connect Wallet</ButtonPrimary>
            ) : (
              <AutoColumn gap={'md'}>
                {(approvalA === ApprovalState.NOT_APPROVED ||
                  approvalA === ApprovalState.PENDING ||
                  approvalB === ApprovalState.NOT_APPROVED ||
                  approvalB === ApprovalState.PENDING) &&
                  isValid && (
                    <RowBetween>
                      {approvalA !== ApprovalState.APPROVED && (
                        <ButtonPrimary
                          onClick={approveACallback}
                          disabled={approvalA === ApprovalState.PENDING}
                          width={approvalB !== ApprovalState.APPROVED ? '48%' : '100%'}
                        >
                          {approvalA === ApprovalState.PENDING ? (
                            <Dots>Approving {currencies[Field.CURRENCY_A]?.symbol}</Dots>
                          ) : (
                            'Approve ' + currencies[Field.CURRENCY_A]?.symbol
                          )}
                        </ButtonPrimary>
                      )}
                      {approvalB !== ApprovalState.APPROVED && (
                        <ButtonPrimary
                          onClick={approveBCallback}
                          disabled={approvalB === ApprovalState.PENDING}
                          width={approvalA !== ApprovalState.APPROVED ? '48%' : '100%'}
                        >
                          {approvalB === ApprovalState.PENDING ? (
                            <Dots>Approving {currencies[Field.CURRENCY_B]?.symbol}</Dots>
                          ) : (
                            'Approve ' + currencies[Field.CURRENCY_B]?.symbol
                          )}
                        </ButtonPrimary>
                      )}
                    </RowBetween>
                  )}
                <ButtonPrimary
                  data-testid="supply-button"
                  onClick={() => {
                    expertMode ? onAdd() : setShowConfirm(true)
                  }}
                  disabled={
                    !isValid ||
                    approvalA !== ApprovalState.APPROVED ||
                    approvalB !== ApprovalState.APPROVED ||
                    !parsedAmounts[Field.CURRENCY_A] ||
                    !parsedAmounts[Field.CURRENCY_B]
                  }
                >
                  {error ?? 'Supply'}
                </ButtonPrimary>
              </AutoColumn>
            )}
          </AutoColumn>
        </Wrapper>
      </AppBody>

      {pair && !noLiquidity && pairState !== PairState.INVALID ? (
        <AutoColumn
          style={{
            minWidth: '20rem',
            width: '100%',
            maxWidth: '400px',
            marginTop: '1rem',
          }}
        >
          <MinimalPositionCard showUnwrapped={oneCurrencyIsWrapped} pair={pair} />
        </AutoColumn>
      ) : null}
    </>
  )
}
