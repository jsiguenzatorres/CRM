import { type CSSProperties, useEffect, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useFrontComponentExecutionContext } from 'twenty-sdk/front-component';

import { CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const useCurrentRecordId = (): string | null =>
  useFrontComponentExecutionContext((context) =>
    context.recordId ??
    (context.selectedRecordIds.length === 1
      ? context.selectedRecordIds[0]
      : null),
  );

type AdditionalPhone = { number: string; callingCode: string };

type PersonPhones = {
  name?: { firstName?: string; lastName?: string };
  phones?: {
    primaryPhoneNumber?: string;
    primaryPhoneCallingCode?: string;
    additionalPhones?: AdditionalPhone[] | null;
  };
};

const styles: Record<string, CSSProperties> = {
  container: {
    padding: '24px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif",
  },
  title: { margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600, color: '#1c1c1a' },
  subtitle: { margin: '0 0 20px 0', fontSize: '13px', color: '#6b7280' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  callLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e4e4e1',
    background: '#ffffff',
    textDecoration: 'none',
    color: '#1c1c1a',
    fontSize: '14px',
    fontWeight: 500,
  },
  callBadge: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#4338ca',
  },
  empty: { padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px' },
};

// A phone number is dialed via the standard `tel:` URI scheme — the browser
// or OS hands it to whatever is registered to handle calls (a softphone app,
// a desktop client, or a phone's own dialer). No VoIP provider or API key
// needed for this. See docs/CLICK_TO_CALL_DESIGN.md for the optional next
// phase (an embedded dialer against a chosen VoIP provider).
const telHref = (callingCode: string | undefined, number: string | undefined): string | null => {
  if (!number) return null;
  const digitsOnly = `${callingCode ?? ''}${number}`.replace(/[^\d+]/g, '');
  return digitsOnly ? `tel:${digitsOnly}` : null;
};

const Call = () => {
  const recordId = useCurrentRecordId();
  const [person, setPerson] = useState<PersonPhones | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recordId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const load = async () => {
      const { people } = await new CoreApiClient().query({
        people: {
          __args: { filter: { id: { eq: recordId } }, first: 1 },
          edges: {
            node: {
              id: true,
              name: { firstName: true, lastName: true },
              phones: {
                primaryPhoneNumber: true,
                primaryPhoneCallingCode: true,
                additionalPhones: true,
              },
            },
          },
        },
      });
      if (cancelled) return;
      setPerson(people?.edges?.[0]?.node ?? null);
    };
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  if (loading) {
    return <div style={styles.empty}>Loading…</div>;
  }

  const fullName = [person?.name?.firstName, person?.name?.lastName]
    .filter(Boolean)
    .join(' ');

  const numbers: { label: string; href: string }[] = [];
  const primaryHref = telHref(
    person?.phones?.primaryPhoneCallingCode,
    person?.phones?.primaryPhoneNumber,
  );
  if (primaryHref) {
    numbers.push({
      label: `${person?.phones?.primaryPhoneCallingCode ?? ''} ${person?.phones?.primaryPhoneNumber}`.trim(),
      href: primaryHref,
    });
  }
  for (const additional of person?.phones?.additionalPhones ?? []) {
    const href = telHref(additional.callingCode, additional.number);
    if (href) {
      numbers.push({ label: `${additional.callingCode} ${additional.number}`.trim(), href });
    }
  }

  if (numbers.length === 0) {
    return <div style={styles.empty}>No phone number on this record.</div>;
  }

  return (
    <div style={styles.container}>
      <p style={styles.title}>{fullName || 'Call'}</p>
      <p style={styles.subtitle}>Opens your device or softphone&apos;s call handler.</p>
      <div style={styles.list}>
        {numbers.map((n) => (
          <a key={n.href} style={styles.callLink} href={n.href}>
            <span>{n.label}</span>
            <span style={styles.callBadge}>Call →</span>
          </a>
        ))}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'call',
  description: "Lists a Person's phone numbers as clickable tel: links.",
  component: Call,
});
