import { SwapPage } from '../../../pages/SwapPage'
import { TokenPicker } from '../../../pages/TokenPicker'
import { TokenMenu } from '../../../pages/TokenMenu'
import { MenuBar } from '../../../pages/MenuBar'

describe('Swap page smoke tests', () => {
  beforeEach(() => {
    cy.clearCookies().clearLocalStorage()
    SwapPage.visitSwapPage()
  })
  it('Should display swap box with 2 inputs and 2 currency selectors', () => {
    SwapPage.getSwapBox().should('be.visible')
    SwapPage.getCurrencySelectors().should('have.length', 2)
    SwapPage.getToInput().should('be.visible')
    SwapPage.getFromInput().should('be.visible')
  })
  it('Should display token menu after clicking select token', () => {
    SwapPage.openTokenToSwapMenu()
    TokenPicker.getPicker().should('be.visible')
  })
  it('Should pick only eth as default from value', () => {
    SwapPage.getCurrencySelectors()
      .first()
      .should('contain.text', 'ETH')
    SwapPage.getCurrencySelectors()
      .last()
      .should('contain.text', 'select Token')
  })
  it('Should type in numbers into from input', () => {
    SwapPage.typeValueFrom('100.323')
    SwapPage.getFromInput().should('contain.value', '100.323')
  })
  it('Should not allow to type not numbers into from input', () => {
    SwapPage.typeValueFrom('!#$%^&*(*)_qewruip')
    SwapPage.getFromInput().should('contain.value', '')
  })
  it('Should type in numbers into from input', () => {
    SwapPage.typeValueTo('100.323')
    SwapPage.getToInput().should('contain.value', '100.323')
  })
  it('Should not allow to type not numbers into from input', () => {
    SwapPage.typeValueTo('!#$%^&*(*)_qewruip')
    SwapPage.getToInput().should('contain.value', '')
  })
  it('Should allow to select wrapped eth token as to input', () => {
    SwapPage.openTokenToSwapMenu().chooseToken('weth')
    SwapPage.getCurrencySelectors()
      .last()
      .focus()
      .should('contain.text', 'WETH')
  })
  it('Should allow to select other token as to input', () => {
    SwapPage.openTokenToSwapMenu().chooseToken('usdc')
    SwapPage.getCurrencySelectors()
      .last()
      .should('contain.text', 'USDC')
  })
  it('Should switch the currency selectors when choosing the same value', () => {
    cy.wait(1000)
    SwapPage.openTokenToSwapMenu().chooseToken('weth')
    SwapPage.getCurrencySelectors()
      .first()
      .click({ force: true })
    TokenMenu.chooseToken('weth')
    SwapPage.getCurrencySelectors()
      .first()
      .should('contain.text', 'WETH')
    SwapPage.getCurrencySelectors()
      .last()
      .should('contain.text', 'ETH')
  })
  it('Should switch token places when using switch button', () => {
    SwapPage.openTokenToSwapMenu().chooseToken('weth')
    SwapPage.switchTokens()
    SwapPage.getCurrencySelectors()
      .first()
      .should('contain.text', 'WETH')
    SwapPage.getCurrencySelectors()
      .last()
      .should('contain.text', 'ETH')
  })
  it('Should connect button which opens network switcher be displayed instead of confirm button', () => {
    SwapPage.getConfirmButton()
      .should('be.visible')
      .should('contain.text', 'Connect wallet')
      .click()
    cy.scrollTo('top')
    SwapPage.getWalletConnectList().should('be.visible')
  })
  it('Should display connect button when transaction data is filled', () => {
    SwapPage.openTokenToSwapMenu().chooseToken('usdc')
    SwapPage.typeValueFrom('100')
    SwapPage.getConfirmButton()
      .should('contain.text', 'Connect wallet')
      .click()

    SwapPage.getWalletConnectList()
      .scrollIntoView()
      .should('be.visible')
  })
  it('Should calculate output based on FROM and display it in TO section', () => {
    SwapPage.openTokenToSwapMenu().chooseToken('usdc')
    SwapPage.typeValueFrom('100')
    SwapPage.getToInput().should('not.be.empty')
  })
  it('Should calculate output based on TO and display it in FROM section', () => {
    SwapPage.openTokenToSwapMenu().chooseToken('usdc')
    SwapPage.typeValueTo('100')
    SwapPage.getFromInput().should('not.be.empty')
  })
})
