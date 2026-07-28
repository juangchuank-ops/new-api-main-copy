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
import { Clock01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { getModelAvailability } from './api'
import type { ModelAvailabilityItem } from './types'

const TIME_RANGES = [1, 6, 24, 72, 168] as const
const EMPTY_MODELS: ModelAvailabilityItem[] = []
const SKELETON_ROWS = ['first', 'second', 'third', 'fourth', 'fifth'] as const

export function ModelAvailability() {
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState('')
  const [hours, setHours] = useState(24)

  const { data, isLoading, error } = useQuery({
    queryKey: ['model-availability', hours],
    queryFn: () => getModelAvailability(hours),
  })

  const models = data?.data?.models ?? EMPTY_MODELS

  // Filter models by search
  const filteredModels = useMemo(() => {
    if (!searchInput.trim()) return models
    const search = searchInput.toLowerCase()
    return models.filter((model) =>
      model.model_name.toLowerCase().includes(search)
    )
  }, [models, searchInput])

  let tableContent: ReactNode
  if (isLoading) {
    tableContent = (
      <div className='space-y-4 p-6'>
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} className='h-12 w-full' />
        ))}
      </div>
    )
  } else if (error) {
    tableContent = (
      <div className='text-muted-foreground p-6 text-center'>
        {t('Failed to load model availability data')}
      </div>
    )
  } else if (filteredModels.length === 0) {
    tableContent = (
      <div className='text-muted-foreground p-6 text-center'>
        {searchInput
          ? t('No models found matching your search')
          : t('No availability data available')}
      </div>
    )
  } else {
    tableContent = (
      <Table className='min-w-[720px]'>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Model Name')}</TableHead>
            <TableHead className='text-right'>{t('Availability')}</TableHead>
            <TableHead className='text-right'>{t('Requests')}</TableHead>
            <TableHead className='text-right'>{t('Success')}</TableHead>
            <TableHead className='text-right'>{t('Failures')}</TableHead>
            <TableHead className='text-right'>{t('Avg Latency')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredModels.map((model) => {
            let badgeClassName = 'bg-red-500'
            if (model.success_rate >= 99) {
              badgeClassName = 'bg-green-500'
            } else if (model.success_rate >= 95) {
              badgeClassName = 'bg-yellow-500'
            }

            return (
              <TableRow key={model.model_name}>
                <TableCell className='font-medium'>
                  {model.model_name}
                </TableCell>
                <TableCell className='text-right'>
                  <Badge className={badgeClassName}>
                    {model.success_rate.toFixed(2)}%
                  </Badge>
                </TableCell>
                <TableCell className='text-right'>
                  {model.request_count.toLocaleString()}
                </TableCell>
                <TableCell className='text-right text-green-600'>
                  {model.success_count.toLocaleString()}
                </TableCell>
                <TableCell className='text-right text-red-600'>
                  {model.failure_count.toLocaleString()}
                </TableCell>
                <TableCell className='text-right'>
                  {model.avg_latency_ms.toLocaleString()}ms
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition>
        <div className='container mx-auto max-w-7xl px-4 pt-24 pb-8'>
          {/* Header */}
          <div className='mb-8'>
            <h1 className='mb-2 text-3xl font-bold'>
              {t('Model Availability')}
            </h1>
            <p className='text-muted-foreground'>
              {t('View real-time model availability and performance metrics')}
            </p>
          </div>

          {/* Filters */}
          <Card className='mb-6'>
            <CardContent className='pt-6'>
              <div className='flex flex-col gap-4 md:flex-row'>
                {/* Search */}
                <div className='min-w-0 flex-1'>
                  <InputGroup className='h-9'>
                    <InputGroupAddon>
                      <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-label={t('Search models...')}
                      placeholder={t('Search models...')}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                  </InputGroup>
                </div>

                {/* Time range selector */}
                <ToggleGroup
                  aria-label={t('Time range')}
                  value={[String(hours)]}
                  onValueChange={(value) => {
                    const nextHours = Number(value[0])
                    if (nextHours > 0) setHours(nextHours)
                  }}
                  variant='outline'
                  size='sm'
                  spacing={2}
                  className='w-full flex-wrap justify-start md:w-auto md:justify-end'
                >
                  {TIME_RANGES.map((range) => (
                    <ToggleGroupItem
                      key={range}
                      value={String(range)}
                      aria-label={`${range}h`}
                    >
                      <HugeiconsIcon
                        icon={Clock01Icon}
                        strokeWidth={2}
                        data-icon='inline-start'
                      />
                      {range}h
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </CardContent>
          </Card>

          {/* Stats Summary */}
          {!isLoading && models.length > 0 && (
            <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-sm font-medium'>
                    {t('Total Models')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{models.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-sm font-medium'>
                    {t('Average Availability')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {(
                      models.reduce((sum, m) => sum + m.success_rate, 0) /
                      models.length
                    ).toFixed(2)}
                    %
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-sm font-medium'>
                    {t('Total Requests')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {models
                      .reduce((sum, m) => sum + m.request_count, 0)
                      .toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Table */}
          <Card>
            <CardContent className='p-0'>{tableContent}</CardContent>
          </Card>
        </div>
      </PageTransition>
    </PublicLayout>
  )
}
