import type { ReactElement } from 'react';

import { ChevronDown } from 'lucide-react';
import {
  useEffect,
  useState,
} from 'react';

import { useDemoControl } from '@/shared/api';
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

import { usePersonaSwitch } from '../model/usePersonaSwitch';

export interface PersonaSwitcherProps {
  className?: string | undefined;
  focusKey: string;
}

export const PersonaSwitcher = ({ className, focusKey }: PersonaSwitcherProps): null | ReactElement => {
  const { t } = useI18n();
  const demoControl = useDemoControl();
  const {
    currentPersona,
    error,
    formatPersona,
    isError,
    isPending,
    isSwitching,
    personas,
    switchToPersona,
    triggerRef,
  } = usePersonaSwitch(focusKey);
  const [isOpen, setIsOpen] = useState(false);

  const isDemoActive = demoControl !== undefined;
  const isSwitcherVisible = isDemoActive && !isError;
  const isMenuBlocked = isPending || isSwitching;

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
    void switchToPersona(personaId);
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
            ref={triggerRef}
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
    </div>
  );
};
