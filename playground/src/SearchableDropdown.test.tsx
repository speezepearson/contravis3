// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchableDropdown from './SearchableDropdown';

afterEach(cleanup);

const OPTIONS = ['apple', 'apricot', 'banana', 'blueberry', 'cherry'];

describe('SearchableDropdown', () => {
  it('renders an input field', () => {
    render(<SearchableDropdown options={OPTIONS} value="" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('shows no popover when input is not focused', () => {
    render(<SearchableDropdown options={OPTIONS} value="" onChange={() => {}} />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows popover with all options when input is focused and empty', async () => {
    const user = userEvent.setup();
    render(<SearchableDropdown options={OPTIONS} value="" onChange={() => {}} />);
    await user.click(screen.getByRole('textbox'));
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeDefined();
    const items = screen.getAllByRole('option');
    expect(items).toHaveLength(5);
  });

  it('filters options based on input text', async () => {
    let value = 'bl';
    const onChange = vi.fn((v: string) => { value = v; });
    const { rerender } = render(
      <SearchableDropdown options={OPTIONS} value={value} onChange={onChange} />
    );
    await userEvent.setup().click(screen.getByRole('textbox'));
    // Rerender with current value to ensure popover reflects filter
    rerender(<SearchableDropdown options={OPTIONS} value={value} onChange={onChange} />);
    const items = screen.getAllByRole('option');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('blueberry');
  });

  it('typing reopens the popover after a selection', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <SearchableDropdown options={OPTIONS} value="" onChange={onChange} />
    );
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{Enter}'); // selects 'apple'
    expect(screen.queryByRole('listbox')).toBeNull();
    // Simulate parent updating value, then user types more
    rerender(<SearchableDropdown options={OPTIONS} value="apple" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'b' } });
    rerender(<SearchableDropdown options={OPTIONS} value="b" onChange={onChange} />);
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('does not call onChange with values outside the options on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <SearchableDropdown options={OPTIONS} value="" onChange={onChange} />
    );
    await user.click(screen.getByRole('textbox'));
    // Type something that doesn't match
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'xyz' } });
    rerender(<SearchableDropdown options={OPTIONS} value="xyz" onChange={onChange} />);
    onChange.mockClear();
    // Blur the input — should revert to empty (last valid value)
    await user.tab();
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('navigates down with ArrowDown and highlights option', async () => {
    const user = userEvent.setup();
    render(<SearchableDropdown options={OPTIONS} value="" onChange={() => {}} />);
    const input = screen.getByRole('textbox');
    await user.click(input);
    // First item is already highlighted by default
    const items = screen.getAllByRole('option');
    expect(items[0].getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowDown}');
    expect(items[1].getAttribute('aria-selected')).toBe('true');
    expect(items[0].getAttribute('aria-selected')).toBe('false');
  });

  it('navigates up with ArrowUp', async () => {
    const user = userEvent.setup();
    render(<SearchableDropdown options={OPTIONS} value="" onChange={() => {}} />);
    const input = screen.getByRole('textbox');
    await user.click(input);
    // Default highlight is 0, ArrowDown twice -> 2, ArrowUp -> 1
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowUp}');
    const items = screen.getAllByRole('option');
    expect(items[1].getAttribute('aria-selected')).toBe('true');
  });

  it('wraps around when navigating past the last option', async () => {
    const opts = ['a', 'b'];
    const user = userEvent.setup();
    render(<SearchableDropdown options={opts} value="" onChange={() => {}} />);
    await user.click(screen.getByRole('textbox'));
    // Default is 0, ArrowDown -> 1, ArrowDown -> 0 (wrap)
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    const items = screen.getAllByRole('option');
    expect(items[0].getAttribute('aria-selected')).toBe('true');
  });

  it('selects highlighted option on Enter and closes popover', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchableDropdown options={OPTIONS} value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await user.click(input);
    // Default is 0 (apple), ArrowDown twice -> 2 (banana)
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('banana');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selects option on click and closes popover', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchableDropdown options={OPTIONS} value="" onChange={onChange} />);
    await user.click(screen.getByRole('textbox'));
    const items = screen.getAllByRole('option');
    await user.click(items[2]); // banana
    expect(onChange).toHaveBeenCalledWith('banana');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes popover on Escape without selecting', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchableDropdown options={OPTIONS} value="" onChange={onChange} />);
    await user.click(screen.getByRole('textbox'));
    expect(screen.getByRole('listbox')).toBeDefined();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('resets highlight to first item when filter changes', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchableDropdown options={OPTIONS} value="" onChange={onChange} />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    // Now change value to filter differently
    rerender(<SearchableDropdown options={OPTIONS} value="ch" onChange={onChange} />);
    const items = screen.getAllByRole('option');
    expect(items).toHaveLength(1);
    // Highlight should be reset to first item
    expect(items[0].getAttribute('aria-selected')).toBe('true');
  });

  it('first option is highlighted by default when popover opens', async () => {
    const user = userEvent.setup();
    render(<SearchableDropdown options={OPTIONS} value="" onChange={() => {}} />);
    await user.click(screen.getByRole('textbox'));
    const items = screen.getAllByRole('option');
    expect(items[0].getAttribute('aria-selected')).toBe('true');
  });

  it('Tab selects the highlighted option and closes popover', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchableDropdown options={OPTIONS} value="" onChange={onChange} />);
    await user.click(screen.getByRole('textbox'));
    await user.tab();
    expect(onChange).toHaveBeenCalledWith('apple');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('filters by word boundary: "ne" matches "neighbor" but not "partner"', async () => {
    const dirOptions = ['partner', 'neighbor', 'opposite'];
    const user = userEvent.setup();
    const { rerender } = render(
      <SearchableDropdown options={dirOptions} value="" onChange={() => {}} />
    );
    await user.click(screen.getByRole('textbox'));
    rerender(<SearchableDropdown options={dirOptions} value="ne" onChange={() => {}} />);
    const items = screen.getAllByRole('option');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('neighbor');
  });

  it('reopens popover when clicked while already focused', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchableDropdown options={OPTIONS} value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeDefined();
    // Select an option (closes popover, keeps focus)
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('listbox')).toBeNull();
    // Click again while still focused — should reopen
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('accepts a placeholder prop', () => {
    render(
      <SearchableDropdown options={OPTIONS} value="" onChange={() => {}} placeholder="Search..." />
    );
    expect(screen.getByPlaceholderText('Search...')).toBeDefined();
  });
});

describe('SearchableDropdown with getLabel', () => {
  const VALS = ['take_hands', 'drop_hands', 'allemande'];
  const LABELS: Record<string, string> = {
    take_hands: 'take hands',
    drop_hands: 'drop hands',
    allemande: 'allemande',
  };
  const getLabel = (v: string) => LABELS[v] ?? v;

  it('displays label of selected value when not focused', () => {
    render(
      <SearchableDropdown options={VALS} value="take_hands" onChange={() => {}} getLabel={getLabel} />
    );
    expect(screen.getByRole('textbox').getAttribute('value')).toBe('take hands');
  });

  it('shows empty input when focused for fresh search', async () => {
    const user = userEvent.setup();
    render(
      <SearchableDropdown options={VALS} value="take_hands" onChange={() => {}} getLabel={getLabel} />
    );
    await user.click(screen.getByRole('textbox'));
    expect(screen.getByRole('textbox').getAttribute('value')).toBe('');
    // All options visible
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('displays labels in the dropdown list', async () => {
    const user = userEvent.setup();
    render(
      <SearchableDropdown options={VALS} value="" onChange={() => {}} getLabel={getLabel} />
    );
    await user.click(screen.getByRole('textbox'));
    const items = screen.getAllByRole('option');
    expect(items[0].textContent).toBe('take hands');
    expect(items[1].textContent).toBe('drop hands');
    expect(items[2].textContent).toBe('allemande');
  });

  it('filters by label text', async () => {
    const user = userEvent.setup();
    render(
      <SearchableDropdown options={VALS} value="" onChange={() => {}} getLabel={getLabel} />
    );
    await user.click(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'drop');
    const items = screen.getAllByRole('option');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('drop hands');
  });

  it('calls onChange with the raw value on selection', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchableDropdown options={VALS} value="" onChange={onChange} getLabel={getLabel} />
    );
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{ArrowDown}'); // highlight "drop_hands"
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('drop_hands');
  });

  it('shows label again after selection and blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <SearchableDropdown options={VALS} value="" onChange={onChange} getLabel={getLabel} />
    );
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{Enter}'); // selects take_hands
    rerender(
      <SearchableDropdown options={VALS} value="take_hands" onChange={onChange} getLabel={getLabel} />
    );
    // After popover closes, input shows the label
    expect(screen.getByRole('textbox').getAttribute('value')).toBe('take hands');
  });
});
