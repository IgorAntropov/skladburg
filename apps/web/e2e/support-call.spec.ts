import {
  DEFAULT_PERSONA,
  DEFAULT_PERSONA_USER_NAME,
  SUPPORT_APP_VERSION_PATTERN,
  SUPPORT_DEVICE_PATTERN,
  SUPPORT_FIRST_TICKET_NUMBER,
  SUPPORT_PERSONAL_DATA_PATTERNS,
  SUPPORT_TEXTS,
} from './fixtures/demoData.ts';
import { test } from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createSupportRobot } from './robots/support-robot.ts';

test.describe('call support', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('sends a ticket with a whitelisted context and receives the reply in the chat, the center and the assistant', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const support = createSupportRobot(page);

    await navigation.openSection('network');
    await navigation.expectSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);

    await support.openHelp();
    await support.openFormFromHelp();
    await support.expectFormOpen();
    await support.expectPreviewText(SUPPORT_TEXTS.noPersonalData);
    await support.expectPreviewRow('Экран', '/network');
    await support.expectPreviewRow('Версия приложения', SUPPORT_APP_VERSION_PATTERN);
    await support.expectPreviewRow('Устройство', SUPPORT_DEVICE_PATTERN);
    await support.expectPreviewHasNoText(DEFAULT_PERSONA_USER_NAME, ...SUPPORT_PERSONAL_DATA_PATTERNS);

    await support.submit();
    await support.expectTicket(SUPPORT_FIRST_TICKET_NUMBER);
    await support.expectTicketTitle(SUPPORT_FIRST_TICKET_NUMBER, SUPPORT_TEXTS.ticketTitle);
    await support.expectWaiting();

    await support.expectReply();

    await support.selectTab('notifications');
    await support.expectNotificationOpenChatLink();

    await support.closePanel();
    await support.expectReplicaOpenChatLink();
    await support.openChatFromReplica();
    await support.expectHelpTabFocused();
    await support.expectReply();

    await support.selectTab('notifications');
    await support.expectTab('notifications');
    await support.expectNotificationOpenChatLink();
  });

  test('opens the chat from the open chat button of the reply notification', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const support = createSupportRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);

    await support.openHelp();
    await support.openFormFromHelp();
    await support.submit();
    await support.expectTicket(SUPPORT_FIRST_TICKET_NUMBER);
    await support.expectReply();

    await support.selectTab('notifications');
    await support.expectNotificationOpenChatLink();
    await support.openChatFromNotificationRow();
    await support.expectTab('help');
    await support.expectHelpTabFocused();
    await support.expectReply();

    await support.selectTab('notifications');
    await support.expectTab('notifications');
    await support.expectNotificationOpenChatLink();
  });

  test('keeps the chosen topic of the open form when the tabs are switched', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const support = createSupportRobot(page);

    await navigation.openSection('network');
    await persona.expectCurrentPersona(DEFAULT_PERSONA);

    await support.openHelp();
    await support.openFormFromHelp();
    await support.chooseCategory(SUPPORT_TEXTS.categoryMoneyOption);
    await support.expectCategory(SUPPORT_TEXTS.categoryMoneyOption);

    await support.selectTab('notifications');
    await support.selectTab('help');

    await support.expectFormOpen();
    await support.expectCategory(SUPPORT_TEXTS.categoryMoneyOption);
  });
});
