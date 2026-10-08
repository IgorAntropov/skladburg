import type { ReactElement } from 'react';

import { ChevronDown } from 'lucide-react';
import {
  useEffect,
  useState,
} from 'react';

import type { DemoPersonaListItemValue } from '@/shared/api';

import {
  useActingContext,
  useDemoControl,
  useSwitchActingContext,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui';

import { usePersonasQuery } from '../api/usePersonasQuery';
import { PERSONA_KIND_MESSAGE_KEYS } from '../model/personaKindMessageKeys';

export interface PersonaSwitcherProps {
  className?: string | undefined;
}

export const PersonaSwitcher = ({ className }: PersonaSwitcherProps): null | ReactElement => {
  const { t } = useI18n();
  const demoControl = useDemoControl();
  const {
    data: personas = [],
    error,
    isError,
    isPending,
  } = usePersonasQuery();
  const { organizationId, userId } = useActingContext();
  const { isSwitching, switchActingContext } = useSwitchActingContext();
  const [isOpen, setIsOpen] = useState(false);

  const isDemoActive = demoControl !== undefined;
  const isSwitcherVisible = isDemoActive && !isError;
  const currentPersona = personas.find(persona => persona.organizationId === organizationId && persona.userId === userId);
  const isMenuBlocked = isPending || isSwitching;
  const switchingStatus = isSwitching ? t('persona.switching') : '';

  const formatPersona = (persona: DemoPersonaListItemValue): string => t('persona.option', {
    kind: t(PERSONA_KIND_MESSAGE_KEYS[persona.kind]),
    organization: persona.organizationName,
  });

  const currentPersonaTitle = currentPersona === undefined ? undefined : formatPersona(currentPersona);
  const triggerLabel = currentPersonaTitle === undefined
    ? t('persona.label')
    : t('persona.trigger.label', { persona: currentPersonaTitle });

  const handleOpenChange = (nextIsOpen: boolean): void => {
    console.log('> PersonaSwitcher -> handleOpenChange:', { isMenuBlocked, nextIsOpen });
    if (nextIsOpen && isMenuBlocked) {
      return;
    }

    setIsOpen(nextIsOpen);
  };

  const handlePersonaValueChange = (personaId: string): void => {
    console.log('> PersonaSwitcher -> handlePersonaValueChange:', { personaId });
    const persona = personas.find(candidate => candidate.id === personaId);

    if (persona === undefined || persona.id === currentPersona?.id) {
      return;
    }

    switchActingContext({ organizationId: persona.organizationId, userId: persona.userId }).catch((switchError: unknown) => {
      console.log('> PersonaSwitcher -> handlePersonaValueChange:', { personaId, switchError });
    });
  };

  useEffect(() => {
    if (isDemoActive && isError) {
      console.log('> PersonaSwitcher -> reportPersonasError:', { error });
    }
  }, [error, isDemoActive, isError]);

  if (!isSwitcherVisible) {
    return null;
  }

  return (
    <div className="flex items-center">
      <DropdownMenu onOpenChange={handleOpenChange} open={isOpen}>
        <DropdownMenuTrigger>
          <Button
            aria-label={triggerLabel}
            className={cn('justify-start', className)}
            disabled={isPending}
            pending={isSwitching}
            pendingLabel={t('persona.switching')}
            variant="secondary"
          >
            <span className="shrink-0 font-normal">{t('persona.label')}</span>
            <span className="min-w-0 flex-1 truncate text-left" translate="no">{currentPersonaTitle}</span>
            <ChevronDown aria-hidden className="size-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" label={t('persona.label')}>
          <DropdownMenuRadioGroup
            label={t('persona.menu.label')}
            onValueChange={handlePersonaValueChange}
            value={currentPersona?.id}
          >
            {personas.map(persona => (
              <DropdownMenuRadioItem key={persona.id} value={persona.id}>
                {formatPersona(persona)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="sr-only" role="status">
        {switchingStatus}
      </span>
    </div>
  );
};
