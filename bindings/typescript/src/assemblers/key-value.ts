import { FragmentId, KeyValueLayoutFragment } from '@vizstack/schema';
import { FragmentAssembler } from '../fragment-assembler';
import _ from 'lodash';

// TODO: KeyValue input: either [[k1, v1], [k2, v2]], or { k1: v1, k2: v2 } => Text(k1) + v1

class KeyValueLayoutFragmentAssembler extends FragmentAssembler {
    private _entries: { key: any; value: any }[] = [];
    private _separator?: string;
    private _startMotif?: string;
    private _endMotif?: string;

    constructor(
        entries?: { key: any; value: any }[],
        separator?: string,
        startMotif?: string,
        endMotif?: string,
    ) {
        super();
        if (entries) this._entries = entries;
        this._separator = separator;
        this._startMotif = startMotif;
        this._endMotif = endMotif;
    }

    public item(key: any, value: any) {
        this._entries.push({ key, value });
        return this;
    }

    public assemble(
        getId: (obj: any, name: string) => FragmentId,
    ): [KeyValueLayoutFragment, any[]] {
        return [
            {
                type: 'KeyValueLayout',
                contents: {
                    entries: this._entries.map(({ key, value }, idx) => ({
                        key: getId(key, `${idx}k`),
                        value: getId(value, `${idx}v`),
                    })),
                    separator: this._separator,
                    startMotif: this._startMotif,
                    endMotif: this._endMotif,
                },
                meta: this._meta,
            },
            _.flatMap(this._entries, ({ key, value }) => [key, value]),
        ];
    }
}

export function KeyValue(
    entries?: { key: any; value: any }[],
    separator?: string,
    startMotif?: string,
    endMotif?: string,
) {
    return new KeyValueLayoutFragmentAssembler(entries, separator, startMotif, endMotif);
}

export interface KeyValue extends ReturnType<typeof KeyValue> {}
