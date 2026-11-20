import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import type { AddressApi, AddressSuggestion } from '../api';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; suggestions: AddressSuggestion[] }
  | { kind: 'none' }
  | { kind: 'unavailable' };

interface Props {
  api: AddressApi;
  /** Called with the id of the picked suggestion. The parent loads the address and fills the form. */
  onPick: (suggestion: AddressSuggestion) => void;
  /** Shown while the parent loads a picked address, and for its failure. */
  message?: { kind: 'loading' | 'unavailable'; text: string } | null;
}

/** "Find address" combobox: suggestions for the typed text, picked by tap, click or arrow keys and Enter. */
export function AddressSearch({ api, onPick, message }: Props) {
  const id = useId();
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abort = useRef<AbortController>(undefined);
  /** Only the answer for the latest text may be shown. */
  const latest = useRef(0);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      abort.current?.abort();
    },
    [],
  );

  function search(value: string) {
    setText(value);
    clearTimeout(timer.current);
    abort.current?.abort();
    const run = ++latest.current;
    setActive(-1);
    if (value.trim().length < MIN_CHARS) {
      setState({ kind: 'idle' });
      return;
    }
    setOpen(true);
    setState({ kind: 'loading' });
    timer.current = setTimeout(() => {
      const controller = new AbortController();
      abort.current = controller;
      api
        .suggest(value.trim(), controller.signal)
        .then((result) => {
          if (run !== latest.current) return;
          if (result.status === 'unavailable') setState({ kind: 'unavailable' });
          else setState(result.suggestions.length > 0 ? { kind: 'results', suggestions: result.suggestions } : { kind: 'none' });
        })
        .catch(() => {
          // An aborted request belongs to older text; anything else is shown as unavailable.
          if (run === latest.current) setState({ kind: 'unavailable' });
        });
    }, DEBOUNCE_MS);
  }

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function pick(s: AddressSuggestion) {
    latest.current++;
    clearTimeout(timer.current);
    abort.current?.abort();
    setText('');
    setState({ kind: 'idle' });
    close();
    onPick(s);
  }

  const suggestions = state.kind === 'results' ? state.suggestions : [];
  const listOpen = open && suggestions.length > 0;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === 'Enter' && listOpen) {
      // Enter never submits the form while the list is open.
      e.preventDefault();
      const s = suggestions[active];
      if (s) pick(s);
    }
  }

  const listId = `${id}-list`;
  const statusText =
    message?.kind === 'loading'
      ? message.text
      : state.kind === 'loading'
        ? 'Searching addresses...'
        : state.kind === 'results' && open
          ? `${suggestions.length} ${suggestions.length === 1 ? 'address' : 'addresses'} found`
          : state.kind === 'none' && open
            ? 'No matching address found. You can fill in the fields yourself.'
            : '';
  const failure = message?.kind === 'unavailable' ? message.text : state.kind === 'unavailable' ? 'The address search is not available right now. You can fill in the fields yourself.' : '';

  return (
    <div onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && close()}>
      <label htmlFor={`${id}-input`} className="label">
        Find address
      </label>
      <input
        id={`${id}-input`}
        name="addressSearch"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-activedescendant={listOpen && active >= 0 ? `${id}-option-${active}` : undefined}
        aria-describedby={`${id}-help`}
        className="input"
        value={text}
        onChange={(e) => search(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <p id={`${id}-help`} className="mt-1 text-sm text-slate-600">
        Start with a street and number, or a postal code and house number.
      </p>
      {listOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching addresses"
          className="mt-1 w-full divide-y divide-slate-100 rounded-lg border border-slate-300 bg-white shadow-sm"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === active}
              className={`flex min-h-11 cursor-pointer items-center break-words px-3 py-2 text-base text-slate-900 ${i === active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-1 text-sm text-slate-700 empty:hidden">
        {statusText}
      </p>
      {failure && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {failure}
        </p>
      )}
    </div>
  );
}
