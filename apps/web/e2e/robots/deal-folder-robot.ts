import type {
  Locator,
  Page,
} from '@playwright/test';
import type { DocumentStatus } from '@skladburg/contracts/document/v1/document';
import type { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';

import { expect } from '@playwright/test';
import { DocumentType } from '@skladburg/contracts/document/v1/document';

import { expectNoAxeViolations } from '../fixtures/axe.ts';

interface DealFolderRobotValue {
  accept: () => Promise<void>;
  closeDocument: () => Promise<void>;
  expectAcceptanceDue: (instant: string, localTime: string) => Promise<void>;
  expectCommission: (amount: string) => Promise<void>;
  expectDocument: (type: DocumentType, status: DocumentStatus, number: number | undefined) => Promise<void>;
  expectNoAxeViolationsOnDocument: () => Promise<void>;
  expectPayment: (status: SafeDealPaymentStatus) => Promise<void>;
  expectPayout: (amount: string) => Promise<void>;
  expectSignatureCount: (count: number) => Promise<void>;
  fund: () => Promise<void>;
  markShipped: () => Promise<void>;
  openDocument: (type: DocumentType) => Promise<void>;
  openInvoiceFromSearch: () => Promise<void>;
  signDocument: () => Promise<void>;
}

export const createDealFolderRobot = (page: Page): DealFolderRobotValue => {
  const documents = page.getByTestId('deal-documents');
  const documentView = page.getByTestId('deal-document-view');
  const payment = page.getByTestId('deal-payment');
  const sign = documentView.getByTestId('deal-document-sign');
  const getDocument = (type: DocumentType): Locator => documents.getByTestId(`deal-document-${String(type)}`);

  return {
    async accept(): Promise<void> {
      await page.getByTestId('deal-accept').click();
    },
    async closeDocument(): Promise<void> {
      await page.getByTestId('deal-document-back').click();
      await expect(documentView).toBeHidden();
    },
    async expectAcceptanceDue(instant, localTime): Promise<void> {
      const deadline = page.getByTestId('deal-acceptance-due');
      await expect(deadline).toBeVisible();
      await expect(deadline).toHaveAttribute('datetime', instant);
      await expect(deadline).toContainText(localTime);
    },
    async expectCommission(amount): Promise<void> {
      await expect(payment.getByTestId('deal-payment-commission')).toHaveText(amount);
    },
    async expectDocument(type, status, number): Promise<void> {
      const document = getDocument(type);
      await expect(document).toBeVisible();
      await expect(document).toHaveAttribute('data-status', String(status));
      await expect(document).toHaveAttribute('data-number', number === undefined ? '' : String(number));
    },
    async expectNoAxeViolationsOnDocument(): Promise<void> {
      await expect(sign).toBeEnabled();
      await expectNoAxeViolations(page);
    },
    async expectPayment(status): Promise<void> {
      await expect(payment).toBeVisible();
      await expect(payment).toHaveAttribute('data-status', String(status));
    },
    async expectPayout(amount): Promise<void> {
      await expect(payment.getByTestId('deal-payment-payout')).toHaveText(amount);
    },
    async expectSignatureCount(count): Promise<void> {
      await expect(documentView.getByTestId('deal-document-signature').filter({ visible: true })).toHaveCount(count);
    },
    async fund(): Promise<void> {
      await page.getByTestId('deal-fund').click();
    },
    async markShipped(): Promise<void> {
      await page.getByTestId('deal-mark-shipped').click();
    },
    async openDocument(type): Promise<void> {
      await getDocument(type).click();
      await expect(documentView).toBeVisible();
    },
    async openInvoiceFromSearch(): Promise<void> {
      const invoice = getDocument(DocumentType.INVOICE);
      const invoiceId = await invoice.getAttribute('data-document-id');
      const invoiceNumber = await invoice.getAttribute('data-number');
      if (!invoiceId || !invoiceNumber) {
        throw new Error('The invoice must have an ID and a number before searching');
      }

      await page.getByTestId('global-search-input').fill(`Счёт ${invoiceNumber}`);
      await page.getByTestId(`global-search-option-documents-${invoiceId}`).click();
      await expect.poll(() => new URL(page.url()).hash.split('?')[0]).toBe(`#/documents/${invoiceId}`);
      await expect(documentView).toBeVisible();
    },
    async signDocument(): Promise<void> {
      await sign.click();
    },
  };
};
