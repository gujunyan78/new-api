/**
 * Preservation Property Test — Property 2
 *
 * Property: 非 USDT 布局相关行为保持不变。
 *
 * 这些测试在未修复代码上应全部通过，确认现有行为基线。
 * 修复后，这些测试也应继续通过（无回归）。
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import fc from 'fast-check';
import RechargeCard from '../RechargeCard';

// --- Mocks ---

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'zh' } }),
}));

vi.mock('../../../helpers/render', () => ({
  getCurrencyConfig: () => ({ symbol: '$', rate: 1, type: 'USD' }),
}));

vi.mock('../SubscriptionPlansCard', () => ({
  default: () => null,
}));

vi.mock('../../../hooks/common/useMinimumLoadingTime', () => ({
  useMinimumLoadingTime: () => false,
}));

// --- Helpers ---

/** Minimal default props to render RechargeCard without crashing */
function makeProps(overrides = {}) {
  return {
    t: (key) => key,
    enableOnlineTopUp: false,
    enableStripeTopUp: false,
    enableCreemTopUp: false,
    enableWaffoTopUp: false,
    enableUsdtTopUp: false,
    creemProducts: [],
    creemPreTopUp: vi.fn(),
    presetAmounts: [],
    selectedPreset: null,
    selectPresetAmount: vi.fn(),
    formatLargeNumber: (n) => String(n),
    priceRatio: 1,
    topUpCount: 10,
    minTopUp: 1,
    renderQuotaWithAmount: (v) => `${v}`,
    getAmount: vi.fn(),
    setTopUpCount: vi.fn(),
    setSelectedPreset: vi.fn(),
    renderAmount: () => '$10',
    amountLoading: false,
    payMethods: [],
    preTopUp: vi.fn(),
    paymentLoading: false,
    payWay: '',
    redemptionCode: '',
    setRedemptionCode: vi.fn(),
    topUp: vi.fn(),
    isSubmitting: false,
    topUpLink: '',
    openTopUpLink: vi.fn(),
    userState: { user: { username: 'test', quota: 1000, request_count: 5 } },
    renderQuota: (v) => `${v}`,
    statusLoading: false,
    topupInfo: {},
    onOpenHistory: vi.fn(),
    waffoTopUp: vi.fn(),
    waffoPayMethods: [],
    usdtMinTopUp: 1,
    onUsdtPay: vi.fn(),
    subscriptionLoading: false,
    subscriptionPlans: [],
    billingPreference: 'payg',
    onChangeBillingPreference: vi.fn(),
    activeSubscriptions: [],
    ...overrides,
  };
}

// --- Arbitraries ---

/** Arbitrary for non-waffo payment methods */
const payMethodArb = fc.record({
  type: fc.constantFrom('alipay', 'wxpay', 'stripe', 'bank'),
  name: fc.constantFrom('支付宝', '微信支付', 'Stripe', '银行卡'),
  icon: fc.constant(''),
  color: fc.constant(''),
  min_topup: fc.nat({ max: 100 }),
});

/** Arbitrary for waffo payment methods */
const waffoMethodArb = fc.record({
  name: fc.constantFrom('MTN Mobile Money', 'Orange Money', 'Airtel Money'),
  icon: fc.constant(''),
});

/** Arbitrary for Creem products */
const creemProductArb = fc.record({
  name: fc.constantFrom('Basic', 'Pro', 'Enterprise'),
  quota: fc.constantFrom('100', '500', '1000'),
  price: fc.constantFrom('9.99', '29.99', '99.99'),
  currency: fc.constantFrom('EUR', 'USD'),
});

// --- Tests ---

describe('Preservation Property — Property 2: Non-USDT behavior unchanged', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  // Requirement 3.1: enableUsdtTopUp=false 时不显示 USDT 按钮
  describe('Req 3.1: USDT button hidden when enableUsdtTopUp=false', () => {
    it('should never render USDT button when enableUsdtTopUp=false (PBT)', () => {
      const configArb = fc.record({
        enableOnlineTopUp: fc.boolean(),
        enableStripeTopUp: fc.boolean(),
        enableWaffoTopUp: fc.boolean(),
        enableCreemTopUp: fc.boolean(),
        payMethods: fc.array(payMethodArb, { minLength: 0, maxLength: 4 }),
        topUpCount: fc.integer({ min: 1, max: 1000 }),
      });

      fc.assert(
        fc.property(configArb, (config) => {
          const { container, unmount } = render(
            <RechargeCard
              {...makeProps({
                ...config,
                enableUsdtTopUp: false, // always false for this property
              })}
            />,
          );

          // No USDT button should exist anywhere in the DOM
          const allButtons = container.querySelectorAll('button');
          const usdtButton = Array.from(allButtons).find(
            (btn) => btn.textContent.trim() === 'USDT',
          );

          // No "USDT 充值" label should exist
          const allLabels = container.querySelectorAll(
            '.semi-form-field-label-text',
          );
          const usdtLabel = Array.from(allLabels).find(
            (el) => el.textContent.trim() === 'USDT 充值',
          );

          unmount();

          expect(usdtButton).toBeUndefined();
          expect(usdtLabel).toBeUndefined();
        }),
        { numRuns: 30 },
      );
    });
  });

  // Requirement 3.4: 非 USDT 支付方式按钮正常渲染
  describe('Req 3.4: Non-USDT pay method buttons render correctly', () => {
    it('should render all non-waffo pay method buttons in "选择支付方式" area (PBT)', () => {
      const nonEmptyPayMethodArb = fc.array(payMethodArb, {
        minLength: 1,
        maxLength: 4,
      });

      fc.assert(
        fc.property(nonEmptyPayMethodArb, (payMethods) => {
          const { container, unmount } = render(
            <RechargeCard
              {...makeProps({
                enableOnlineTopUp: true,
                enableStripeTopUp: true,
                payMethods,
                enableUsdtTopUp: false,
              })}
            />,
          );

          // Find "选择支付方式" area
          const allSlots = container.querySelectorAll('.semi-form-field');
          let payMethodSlot = null;
          for (const slot of allSlots) {
            const label = slot.querySelector('.semi-form-field-label-text');
            if (label && label.textContent.trim() === '选择支付方式') {
              payMethodSlot = slot;
              break;
            }
          }

          expect(payMethodSlot).not.toBeNull();

          // Each non-waffo pay method should have a corresponding button
          const nonWaffoMethods = payMethods.filter(
            (m) => m.type !== 'waffo',
          );
          const buttons = payMethodSlot.querySelectorAll('button');
          const buttonTexts = Array.from(buttons).map((btn) =>
            btn.textContent.trim(),
          );

          for (const method of nonWaffoMethods) {
            expect(buttonTexts).toContain(method.name);
          }

          unmount();
        }),
        { numRuns: 20 },
      );
    });

    it('should call preTopUp with correct type when a pay method button is clicked (PBT)', () => {
      const methodTypeArb = fc.constantFrom('alipay', 'wxpay', 'stripe');

      fc.assert(
        fc.property(methodTypeArb, (methodType) => {
          const nameMap = {
            alipay: '支付宝',
            wxpay: '微信支付',
            stripe: 'Stripe',
          };
          const preTopUp = vi.fn();
          const payMethods = [
            { type: methodType, name: nameMap[methodType], icon: '', color: '', min_topup: 0 },
          ];

          const { container, unmount } = render(
            <RechargeCard
              {...makeProps({
                enableOnlineTopUp: true,
                enableStripeTopUp: true,
                payMethods,
                preTopUp,
                enableUsdtTopUp: false,
              })}
            />,
          );

          const buttons = container.querySelectorAll('button');
          const targetBtn = Array.from(buttons).find(
            (btn) => btn.textContent.trim() === nameMap[methodType],
          );

          expect(targetBtn).toBeDefined();
          if (targetBtn && !targetBtn.disabled) {
            fireEvent.click(targetBtn);
            expect(preTopUp).toHaveBeenCalledWith(methodType);
          }

          unmount();
        }),
        { numRuns: 10 },
      );
    });
  });

  // Requirement 3.5: Waffo 区域作为独立区域渲染
  describe('Req 3.5: Waffo area renders as independent section', () => {
    it('should render Waffo area with its own label when enabled (PBT)', () => {
      const waffoMethodsArb = fc.array(waffoMethodArb, {
        minLength: 1,
        maxLength: 3,
      });

      fc.assert(
        fc.property(waffoMethodsArb, (waffoPayMethods) => {
          const { container, unmount } = render(
            <RechargeCard
              {...makeProps({
                enableWaffoTopUp: true,
                enableOnlineTopUp: true,
                waffoPayMethods,
                enableUsdtTopUp: false,
              })}
            />,
          );

          // "Waffo 充值" should exist as its own Form.Slot label
          const allLabels = container.querySelectorAll(
            '.semi-form-field-label-text',
          );
          const waffoLabel = Array.from(allLabels).find(
            (el) => el.textContent.trim() === 'Waffo 充值',
          );

          expect(waffoLabel).toBeDefined();

          // Each waffo method should have a button
          if (waffoLabel) {
            const waffoSlot = waffoLabel.closest('.semi-form-field');
            const buttons = waffoSlot
              ? Array.from(waffoSlot.querySelectorAll('button'))
              : [];
            const buttonTexts = buttons.map((btn) => btn.textContent.trim());
            for (const method of waffoPayMethods) {
              expect(buttonTexts).toContain(method.name);
            }
          }

          unmount();
        }),
        { numRuns: 10 },
      );
    });
  });

  // Requirement 3.5 (Creem): Creem 区域作为独立区域渲染
  describe('Req 3.5: Creem area renders as independent section', () => {
    it('should render Creem area with its own label when enabled', () => {
      const creemProducts = [
        { name: 'Basic', quota: '100', price: '9.99', currency: 'EUR' },
        { name: 'Pro', quota: '500', price: '29.99', currency: 'USD' },
      ];

      const { container } = render(
        <RechargeCard
          {...makeProps({
            enableCreemTopUp: true,
            creemProducts,
            enableUsdtTopUp: false,
          })}
        />,
      );

      const allLabels = container.querySelectorAll(
        '.semi-form-field-label-text',
      );
      const creemLabel = Array.from(allLabels).find(
        (el) => el.textContent.trim() === 'Creem 充值',
      );

      expect(creemLabel).toBeDefined();
    });
  });

  // Requirement 3.2 & 3.3: USDT 支付逻辑（onUsdtPay）在启用时正常工作
  describe('Req 3.2/3.3: USDT pay logic preserved when enabled', () => {
    it('should call onUsdtPay when USDT button is clicked', () => {
      const onUsdtPay = vi.fn();

      const { container } = render(
        <RechargeCard
          {...makeProps({
            enableUsdtTopUp: true,
            onUsdtPay,
            topUpCount: 10,
            usdtMinTopUp: 1,
          })}
        />,
      );

      const buttons = container.querySelectorAll('button');
      const usdtBtn = Array.from(buttons).find(
        (btn) => btn.textContent.trim() === 'USDT',
      );

      expect(usdtBtn).toBeDefined();
      if (usdtBtn) {
        fireEvent.click(usdtBtn);
        expect(onUsdtPay).toHaveBeenCalledTimes(1);
      }
    });
  });

  // Combined preservation: full config without USDT should not show any USDT elements
  describe('Combined preservation: complex configs without USDT', () => {
    it('should preserve full layout with all non-USDT features enabled (PBT)', () => {
      const configArb = fc.record({
        payMethods: fc.array(payMethodArb, { minLength: 1, maxLength: 3 }),
        waffoPayMethods: fc.array(waffoMethodArb, { minLength: 0, maxLength: 2 }),
        enableWaffoTopUp: fc.boolean(),
        enableCreemTopUp: fc.boolean(),
      });

      fc.assert(
        fc.property(configArb, (config) => {
          const creemProducts = config.enableCreemTopUp
            ? [{ name: 'Basic', quota: '100', price: '9.99', currency: 'EUR' }]
            : [];

          const { container, unmount } = render(
            <RechargeCard
              {...makeProps({
                enableOnlineTopUp: true,
                enableStripeTopUp: true,
                enableUsdtTopUp: false,
                ...config,
                creemProducts,
              })}
            />,
          );

          // No USDT elements anywhere
          const allButtons = container.querySelectorAll('button');
          const usdtButton = Array.from(allButtons).find(
            (btn) => btn.textContent.trim() === 'USDT',
          );
          expect(usdtButton).toBeUndefined();

          const allLabels = container.querySelectorAll(
            '.semi-form-field-label-text',
          );
          const usdtLabel = Array.from(allLabels).find(
            (el) => el.textContent.trim() === 'USDT 充值',
          );
          expect(usdtLabel).toBeUndefined();

          // "选择支付方式" should still render with pay methods
          const payMethodLabel = Array.from(allLabels).find(
            (el) => el.textContent.trim() === '选择支付方式',
          );
          const nonWaffoMethods = config.payMethods.filter(
            (m) => m.type !== 'waffo',
          );
          if (nonWaffoMethods.length > 0) {
            expect(payMethodLabel).toBeDefined();
          }

          // Waffo area should render if enabled with methods
          if (config.enableWaffoTopUp && config.waffoPayMethods.length > 0) {
            const waffoLabel = Array.from(allLabels).find(
              (el) => el.textContent.trim() === 'Waffo 充值',
            );
            expect(waffoLabel).toBeDefined();
          }

          // Creem area should render if enabled with products
          if (config.enableCreemTopUp && creemProducts.length > 0) {
            const creemLabel = Array.from(allLabels).find(
              (el) => el.textContent.trim() === 'Creem 充值',
            );
            expect(creemLabel).toBeDefined();
          }

          unmount();
        }),
        { numRuns: 30 },
      );
    });
  });
});
