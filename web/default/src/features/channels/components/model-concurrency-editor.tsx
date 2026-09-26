/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useId } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAX_MODEL_CONCURRENCY } from '../constants'

export type ModelConcurrencyRow = {
  model: string
  limit: number
}

type ModelConcurrencyEditorProps = {
  rows: ModelConcurrencyRow[]
  models: string[]
  onChange: (rows: ModelConcurrencyRow[]) => void
  disabled?: boolean
}

export function ModelConcurrencyEditor(props: ModelConcurrencyEditorProps) {
  const { t } = useTranslation()
  const modelListId = useId()
  const rows = props.rows || []

  const updateRow = (index: number, patch: Partial<ModelConcurrencyRow>) => {
    props.onChange(
      rows.map((row, current) =>
        current === index ? { ...row, ...patch } : row
      )
    )
  }

  const removeRow = (index: number) => {
    props.onChange(rows.filter((_, current) => current !== index))
  }

  const addRow = () => {
    props.onChange([...rows, { model: '', limit: 10 }])
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='text-muted-foreground text-xs'>
        {t(
          'Leave it empty by default. A model configured here uses its own concurrency limit and is counted independently, no longer bound by the channel-level limit; other models share the channel-level limit.'
        )}
      </div>

      {rows.length === 0 && (
        <div className='text-muted-foreground text-xs'>
          {t('No model configured yet')}
        </div>
      )}

      {rows.map((row, index) => (
        <div key={index} className='flex items-center gap-2'>
          <Input
            value={row.model}
            onChange={(e) => updateRow(index, { model: e.target.value })}
            placeholder={t('Select or type a model name')}
            disabled={props.disabled}
            list={modelListId}
          />
          <Input
            type='number'
            min={1}
            max={MAX_MODEL_CONCURRENCY}
            className='w-40 shrink-0'
            value={Number.isFinite(row.limit) ? row.limit : ''}
            onChange={(e) => {
              const raw = e.target.value
              updateRow(index, { limit: raw === '' ? NaN : Number(raw) })
            }}
            placeholder={t('Concurrency limit')}
            disabled={props.disabled}
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-10 w-10 shrink-0'
            onClick={() => removeRow(index)}
            disabled={props.disabled}
            aria-label={t('Delete')}
          >
            <Trash2 className='h-4 w-4' aria-hidden='true' />
          </Button>
        </div>
      ))}

      <Button
        type='button'
        variant='outline'
        size='sm'
        className='self-start'
        onClick={addRow}
        disabled={props.disabled}
      >
        <Plus className='h-4 w-4' aria-hidden='true' />
        {t('Add model concurrency')}
      </Button>

      {props.models.length > 0 && (
        <datalist id={modelListId}>
          {props.models.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
      )}
    </div>
  )
}
