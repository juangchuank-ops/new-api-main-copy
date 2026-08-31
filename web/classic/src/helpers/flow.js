/*
Copyright (C) 2025 QuantumNous

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

// 分流（Sankey）数据构建：从新版前端 features/dashboard/lib/flow.ts 移植的
// 纯函数实现，供旧版数据看板使用。聚合 /api/data/flow 返回的行数据为
// {nodes, links} 图并生成 VChart 桑基 spec（兼容 VChart 1.8）。

const DEFAULT_FLOW_ROLE = 'user';
const DEFAULT_FLOW_OVERFLOW_MODE = 'aggregate';
const DEFAULT_FLOW_CHART_COLOR = '#1664FF';

// 固定调色板（新版从 VChart 2.x 主题拉取，旧版 1.8 无对应 API，改为固定色板）
const FLOW_PALETTE = [
  '#1664FF', '#16B0A8', '#6C4AE8', '#F5A623', '#EE6F2D',
  '#2E7EFF', '#38C96A', '#E86FC8', '#8F6BF2', '#C9CCD4',
  '#3AD0FF', '#7B933B', '#FF6B6B', '#4A90E2', '#B37FEB',
  '#36CFC9', '#FFA940', '#F759AB', '#9254DE', '#597EF7',
];

const FLOW_NODE_KINDS = ['user', 'node', 'token', 'group', 'model', 'channel'];
const FLOW_NODE_KIND_SET = new Set(FLOW_NODE_KINDS);

const OTHER_FLOW_NODE_IDS = {
  user: 'user:__other__',
  node: 'node:__other__',
  token: 'token:__other__',
  group: 'group:__other__',
  model: 'model:__other__',
  channel: 'channel:__other__',
};

const DEFAULT_OTHER_FLOW_NODE_LABELS = {
  user: 'Other users',
  node: 'Other nodes',
  token: 'Other tokens',
  group: 'Other groups',
  model: 'Other models',
  channel: 'Other channels',
};

// 标签可能泄露身份的类别（人、密钥、基础设施、业务配置）。
// 模型名是公开的，遮罩时保持可见。
const SENSITIVE_FLOW_KINDS = new Set([
  'user',
  'node',
  'token',
  'group',
  'channel',
]);

const OTHER_FLOW_NODE_ID_SET = new Set(Object.values(OTHER_FLOW_NODE_IDS));

// 桑基图至少需要两列才能画出连线，隐藏列时永远不会低于这个数。
const MIN_FLOW_STAGES = 2;

const ROLE_FLOW_STAGES = {
  root: ['user', 'node', 'token', 'group', 'model', 'channel'],
  admin: ['user', 'group', 'model', 'channel'],
  user: ['token', 'group', 'model'],
};

const FLOW_MASK_TEXT = '••••';

export function getFlowStages(role) {
  return ROLE_FLOW_STAGES[role] || ROLE_FLOW_STAGES[DEFAULT_FLOW_ROLE];
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isFlowNodeKind(value) {
  return typeof value === 'string' && FLOW_NODE_KIND_SET.has(value);
}

function rowMetrics(row) {
  return {
    quota: numberValue(row.quota),
    tokens: numberValue(row.token_used),
    requests: numberValue(row.count),
  };
}

function metricValue(metrics, metric) {
  if (metric === 'requests') return metrics.requests;
  if (metric === 'tokens') return metrics.tokens;
  return metrics.quota;
}

function userNode(row) {
  const userID = numberValue(row.user_id);
  return {
    id: userID > 0 ? `user:${userID}` : `user:${row.username || 'unknown'}`,
    label: row.username || (userID > 0 ? `user-${userID}` : 'Unknown User'),
    kind: 'user',
  };
}

function nodeNameNode(row) {
  const nodeName = row.node_name || 'default-node';
  return {
    id: `node:${nodeName}`,
    label: nodeName,
    kind: 'node',
  };
}

function tokenNode(row, ctx) {
  const tokenID = numberValue(row.token_id);
  return {
    id:
      tokenID > 0
        ? `token:${tokenID}`
        : `token:${row.token_name || 'unknown'}`,
    label: row.token_name || deletedTokenLabel(tokenID, ctx),
    kind: 'token',
  };
}

function deletedTokenLabel(tokenID, ctx) {
  if (tokenID <= 0) return 'Unknown Token';
  return ctx.deletedTokenLabel ? ctx.deletedTokenLabel(tokenID) : `token-${tokenID}`;
}

function groupNode(row) {
  const useGroup = row.use_group || 'unknown';
  return {
    id: `group:${useGroup}`,
    label: useGroup,
    kind: 'group',
  };
}

function modelNode(row) {
  return {
    id: `model:${row.model_name || 'unknown'}`,
    label: row.model_name || 'Unknown Model',
    kind: 'model',
  };
}

function channelNode(row) {
  const channelID = numberValue(row.channel_id);
  return {
    id:
      channelID > 0
        ? `channel:${channelID}`
        : `channel:${row.channel_name || 'unknown'}`,
    label:
      row.channel_name || (channelID > 0 ? `channel-${channelID}` : 'Unknown'),
    kind: 'channel',
  };
}

const NODE_BUILDERS = {
  user: userNode,
  node: nodeNameNode,
  token: tokenNode,
  group: groupNode,
  model: modelNode,
  channel: channelNode,
};

function resolveVisibleStages(role, visibleStages) {
  const stages = getFlowStages(role);
  if (!visibleStages) return stages;
  const visible = new Set(visibleStages);
  const filtered = stages.filter((stage) => visible.has(stage));
  return filtered.length >= MIN_FLOW_STAGES ? filtered : stages;
}

function flowPathForStages(row, stages, ctx) {
  return stages.map((stage) => NODE_BUILDERS[stage](row, ctx));
}

function colorAt(index, palette) {
  const colors = palette && palette.length > 0 ? palette : FLOW_PALETTE;
  return colors[index % colors.length] || DEFAULT_FLOW_CHART_COLOR;
}

function alphaColor(color, alpha) {
  const normalized = String(color || '').trim();
  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return { color: normalized, alpha };
  }
  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return {
    color: `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`,
    alpha: 1,
  };
}

function stableColorMap(keys, palette) {
  const map = new Map();
  const uniqueKeys = [...new Set(keys)];
  const colors =
    palette && palette.length > 0 ? palette : FLOW_PALETTE;
  uniqueKeys.forEach((key, index) => {
    map.set(key, colorAt(index, colors));
  });
  return map;
}

function filterRowsByUsers(rows, selectedUsers) {
  const users = new Set(selectedUsers || []);
  if (users.size === 0) return rows;
  return rows.filter((row) => users.has(userNode(row).id));
}

function normalizeSelectedNodeFilters(selectedNodes, stages) {
  const visibleKinds = new Set(stages);
  const filters = new Map();
  for (const filter of selectedNodes || []) {
    if (!visibleKinds.has(filter.kind)) continue;
    const selected = filters.get(filter.kind) || new Set();
    selected.add(filter.id);
    filters.set(filter.kind, selected);
  }
  return filters;
}

function pathMatchesNodeFilters(path, filters) {
  if (filters.size === 0) return true;
  const pathNodesByKind = new Map();
  for (const node of path) {
    const ids = pathNodesByKind.get(node.kind) || new Set();
    ids.add(node.id);
    pathNodesByKind.set(node.kind, ids);
  }
  for (const [kind, selectedIds] of filters) {
    const pathIds = pathNodesByKind.get(kind);
    if (!pathIds) return false;
    let hasSelectedNode = false;
    for (const id of selectedIds) {
      if (pathIds.has(id)) {
        hasSelectedNode = true;
        break;
      }
    }
    if (!hasSelectedNode) return false;
  }
  return true;
}

function filterRowsByNodes(rows, selectedNodes, stages, ctx) {
  const filters = normalizeSelectedNodeFilters(selectedNodes, stages);
  if (filters.size === 0) return rows;
  return rows.filter((row) =>
    pathMatchesNodeFilters(flowPathForStages(row, stages, ctx), filters),
  );
}

function selectedNodeFiltersExceptKind(selectedNodes, kind) {
  const filtered = (selectedNodes || []).filter(
    (filter) => filter.kind !== kind,
  );
  return filtered.length > 0 ? filtered : undefined;
}

function addNode(map, pathNode, metrics, metric, color, colorKey) {
  const previous = map.get(pathNode.id) || {
    id: pathNode.id,
    label: pathNode.label,
    kind: pathNode.kind,
    value: 0,
    requests: 0,
    quota: 0,
    tokens: 0,
    color,
    colorKey,
  };
  previous.value += metricValue(metrics, metric);
  previous.requests += metrics.requests;
  previous.quota += metrics.quota;
  previous.tokens += metrics.tokens;
  map.set(pathNode.id, previous);
}

function addLink(map, source, target, metrics, metric, color, colorKey) {
  const key = `${source.id}\u0000${target.id}`;
  const previous = map.get(key) || {
    source: source.id,
    target: target.id,
    value: 0,
    requests: 0,
    quota: 0,
    tokens: 0,
    sourceLabel: source.label,
    targetLabel: target.label,
    color,
    linkColor: color,
    linkAlpha: 1,
    hoverColor: color,
    colorKey,
    share: 0,
  };
  previous.value += metricValue(metrics, metric);
  previous.requests += metrics.requests;
  previous.quota += metrics.quota;
  previous.tokens += metrics.tokens;
  map.set(key, previous);
}

function assignLinkDisplayColors(links) {
  const linksBySource = new Map();
  for (const link of links) {
    const sourceLinks = linksBySource.get(link.source) || [];
    sourceLinks.push(link);
    linksBySource.set(link.source, sourceLinks);
  }
  for (const sourceLinks of linksBySource.values()) {
    const sortedLinks = [...sourceLinks].sort(
      (a, b) =>
        b.value - a.value || linkStableKey(a).localeCompare(linkStableKey(b)),
    );
    const denominator = Math.max(sortedLinks.length - 1, 1);
    sortedLinks.forEach((link, index) => {
      const alpha =
        sortedLinks.length === 1 ? 0.34 : 0.24 + (index / denominator) * 0.2;
      const displayColor = alphaColor(link.color, alpha);
      link.linkColor = displayColor.color;
      link.linkAlpha = displayColor.alpha;
      link.hoverColor = link.color;
    });
  }
}

function byValueThenLabel(a, b) {
  return b.value - a.value || a.label.localeCompare(b.label);
}

function linkStableKey(link) {
  return `${link.source}\u0000${link.target}`;
}

function byLinkDrawPriority(a, b) {
  return (
    Number(a.dimmed) - Number(b.dimmed) ||
    Number(b.highlighted) - Number(a.highlighted) ||
    b.value - a.value ||
    linkStableKey(a).localeCompare(linkStableKey(b))
  );
}

function buildSummary(rows) {
  return rows.reduce(
    (summary, row) => {
      const metrics = rowMetrics(row);
      summary.quota += metrics.quota;
      summary.tokens += metrics.tokens;
      summary.requests += metrics.requests;
      return summary;
    },
    { quota: 0, tokens: 0, requests: 0 },
  );
}

function normalizeTopNodeLimit(limit) {
  if (limit === undefined || limit === null) return undefined;
  const parsed = Math.floor(limit);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function otherFlowNode(kind, labeler) {
  return {
    id: OTHER_FLOW_NODE_IDS[kind],
    label: labeler ? labeler(kind) : DEFAULT_OTHER_FLOW_NODE_LABELS[kind],
    kind,
  };
}

function buildTopNodeSets(rows, metric, stages, limit, ctx) {
  if (!limit) return undefined;
  const totals = new Map();
  for (const stage of stages) {
    totals.set(stage, new Map());
  }
  for (const row of rows) {
    const metrics = rowMetrics(row);
    const value = metricValue(metrics, metric);
    const path = flowPathForStages(row, stages, ctx);
    for (const node of path) {
      const stageTotals = totals.get(node.kind);
      if (!stageTotals) continue;
      const current = stageTotals.get(node.id) || { node, value: 0 };
      current.value += value;
      stageTotals.set(node.id, current);
    }
  }
  const topSets = new Map();
  for (const [kind, stageTotals] of totals) {
    const topIds = [...stageTotals.values()]
      .sort(
        (a, b) =>
          b.value - a.value ||
          a.node.label.localeCompare(b.node.label) ||
          a.node.id.localeCompare(b.node.id),
      )
      .slice(0, limit)
      .map((rank) => rank.node.id);
    topSets.set(kind, new Set(topIds));
  }
  return topSets;
}

function isTopFlowNode(node, topNodeSets) {
  const topNodes = topNodeSets && topNodeSets.get(node.kind);
  return !topNodes || topNodes.has(node.id);
}

function applyTopNodeLimit(path, topNodeSets, mode, labeler) {
  if (!topNodeSets) return path;
  const containsOverflowNode = path.some(
    (node) => !isTopFlowNode(node, topNodeSets),
  );
  if (!containsOverflowNode) return path;
  if (mode === 'hide') return undefined;
  return path.map((node) =>
    isTopFlowNode(node, topNodeSets) ? node : otherFlowNode(node.kind, labeler),
  );
}

function maskFlowGraphLabels(nodes, links) {
  const maskedById = new Map();
  for (const node of nodes.values()) {
    if (!SENSITIVE_FLOW_KINDS.has(node.kind)) continue;
    if (OTHER_FLOW_NODE_ID_SET.has(node.id)) continue;
    if (!node.label) continue;
    node.label = FLOW_MASK_TEXT;
    maskedById.set(node.id, FLOW_MASK_TEXT);
  }
  if (maskedById.size === 0) return;
  for (const link of links.values()) {
    const sourceMasked = maskedById.get(link.source);
    if (sourceMasked !== undefined) link.sourceLabel = sourceMasked;
    const targetMasked = maskedById.get(link.target);
    if (targetMasked !== undefined) link.targetLabel = targetMasked;
  }
}

function buildFlowGraph(
  rows,
  metric,
  role,
  visibleStages,
  ctx,
  options,
) {
  const stages = resolveVisibleStages(role, visibleStages);
  const topNodeSets = buildTopNodeSets(
    rows,
    metric,
    stages,
    normalizeTopNodeLimit(options.topNodeLimit),
    ctx,
  );
  const overflowMode = options.overflowMode || DEFAULT_FLOW_OVERFLOW_MODE;
  const preparedPaths = [];

  for (const row of rows) {
    const path = applyTopNodeLimit(
      flowPathForStages(row, stages, ctx),
      topNodeSets,
      overflowMode,
      options.otherNodeLabel,
    );
    if (!path) continue;
    preparedPaths.push({ path, metrics: rowMetrics(row) });
  }

  const nodes = new Map();
  const links = new Map();
  const colors = stableColorMap(
    preparedPaths
      .map((prepared) => prepared.path[0] && prepared.path[0].id)
      .filter((id) => Boolean(id))
      .sort((a, b) => a.localeCompare(b)),
  );

  for (const prepared of preparedPaths) {
    const { path, metrics } = prepared;
    const root = path[0];
    if (!root) continue;
    const color = colors.get(root.id) || colorAt(0);

    for (const node of path) {
      addNode(nodes, node, metrics, metric, color, root.id);
    }
    for (let i = 0; i < path.length - 1; i++) {
      const source = path[i];
      const target = path[i + 1];
      if (!source || !target) continue;
      addLink(links, source, target, metrics, metric, color, root.id);
    }
  }
  if (options.maskSensitive) {
    maskFlowGraphLabels(nodes, links);
  }

  const flowLinks = [...links.values()].sort(
    (a, b) =>
      a.source.localeCompare(b.source) || a.target.localeCompare(b.target),
  );
  const firstStepSources = new Set(
    preparedPaths
      .map((prepared) => prepared.path[0] && prepared.path[0].id)
      .filter((id) => Boolean(id)),
  );
  const total = flowLinks
    .filter((link) => firstStepSources.has(link.source))
    .reduce((sum, link) => sum + link.value, 0);
  for (const link of flowLinks) {
    link.share = total > 0 ? link.value / total : 0;
  }
  assignLinkDisplayColors(flowLinks);

  return {
    nodes: [...nodes.values()].sort(byValueThenLabel),
    links: flowLinks,
  };
}

function formatNumber(value) {
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value,
  );
}

function buildNodeFilterOptions(
  rows,
  metric,
  role,
  visibleStages,
  ctx,
  selectedNodes,
) {
  const stages = resolveVisibleStages(role, visibleStages);
  const stageOrder = new Map(stages.map((stage, index) => [stage, index]));
  const colorIds = new Set();
  for (const row of rows) {
    for (const node of flowPathForStages(row, stages, ctx)) {
      colorIds.add(node.id);
    }
  }
  const colors = stableColorMap([...colorIds].sort((a, b) => a.localeCompare(b)));
  const options = [];

  for (const stage of stages) {
    const totals = new Map();
    const candidateRows = filterRowsByNodes(
      rows,
      selectedNodeFiltersExceptKind(selectedNodes, stage),
      stages,
      ctx,
    );
    for (const row of candidateRows) {
      const metrics = rowMetrics(row);
      const value = metricValue(metrics, metric);
      const node = NODE_BUILDERS[stage](row, ctx);
      const current = totals.get(node.id) || { node, value: 0 };
      current.value += value;
      totals.set(node.id, current);
    }
    for (const rank of totals.values()) {
      options.push({
        kind: rank.node.kind,
        value: rank.node.id,
        label: rank.node.label,
        valueLabel: formatNumber(rank.value),
        valueRaw: rank.value,
        color: colors.get(rank.node.id) || colorAt(0),
      });
    }
  }

  return options.sort(
    (a, b) =>
      (stageOrder.get(a.kind) || 0) - (stageOrder.get(b.kind) || 0) ||
      b.valueRaw - a.valueRaw ||
      a.label.localeCompare(b.label) ||
      a.value.localeCompare(b.value),
  );
}

export function buildDashboardFlowData(rows, metric = 'quota', options = {}) {
  const role = options.role || DEFAULT_FLOW_ROLE;
  const ctx = { deletedTokenLabel: options.deletedTokenLabel };
  const stages = resolveVisibleStages(role, options.visibleStages);
  const userFilteredRows = filterRowsByUsers(rows, options.selectedUsers);
  const filteredRows = filterRowsByNodes(
    userFilteredRows,
    options.selectedNodes,
    stages,
    ctx,
  );

  return {
    summary: buildSummary(filteredRows),
    flow: buildFlowGraph(filteredRows, metric, role, options.visibleStages, ctx, {
      topNodeLimit: options.topNodeLimit,
      overflowMode: options.overflowMode,
      otherNodeLabel: options.otherNodeLabel,
      maskSensitive: options.maskSensitive,
    }),
    filterOptions: {
      nodes: buildNodeFilterOptions(
        userFilteredRows,
        metric,
        role,
        options.visibleStages,
        ctx,
        options.selectedNodes,
      ),
    },
  };
}

function recordValue(value) {
  return value && typeof value === 'object' ? value : undefined;
}

function sankeyDatumSource(datum) {
  const nested = datum.datum;
  if (Array.isArray(nested)) {
    const depth = numberValue(datum.depth);
    return recordValue(nested[depth]) || recordValue(nested[0]) || datum;
  }
  return recordValue(nested) || datum;
}

function sankeyDatumValue(datum, key) {
  if (datum[key] !== undefined) return datum[key];
  const source = sankeyDatumSource(datum);
  return source[key];
}

function sankeyDatumFlag(datum, key) {
  return sankeyDatumValue(datum, key) === true;
}

function tooltipMetricLines(valueFormatter, labels) {
  const metricValueOf = (datum, key) => numberValue(sankeyDatumValue(datum, key));
  return [
    {
      key: labels.quota,
      value: (datum) => valueFormatter(metricValueOf(datum, 'quota')),
    },
    {
      key: labels.tokens,
      value: (datum) => formatNumber(metricValueOf(datum, 'tokens')),
    },
    {
      key: labels.requests,
      value: (datum) => formatNumber(metricValueOf(datum, 'requests')),
    },
    {
      key: labels.share,
      value: (datum) => `${(metricValueOf(datum, 'share') * 100).toFixed(1)}%`,
      visible: (datum) => metricValueOf(datum, 'share') > 0,
    },
  ];
}

export function buildFlowSankeySpec(
  flow,
  title,
  valueFormatter = formatNumber,
  labels = { quota: 'Quota', tokens: 'Tokens', requests: 'Requests', share: 'Share' },
) {
  return {
    type: 'sankey',
    data: [
      {
        id: 'flow',
        values: [
          {
            nodes: flow.nodes.map((node) => ({
              key: node.id,
              name: node.label,
              rawLabel: node.label,
              kind: node.kind,
              value: node.value,
              requests: node.requests,
              quota: node.quota,
              tokens: node.tokens,
              color: node.color,
              colorKey: node.colorKey,
            })),
            links: flow.links
              .filter((link) => link.value > 0)
              .sort(byLinkDrawPriority)
              .map((link, index) => ({
                source: link.source,
                target: link.target,
                linkKey: linkStableKey(link),
                sourceLabel: link.sourceLabel,
                targetLabel: link.targetLabel,
                value: link.value,
                requests: link.requests,
                quota: link.quota,
                tokens: link.tokens,
                color: link.color,
                linkColor: link.linkColor,
                linkAlpha: link.linkAlpha,
                hoverColor: link.hoverColor,
                colorKey: link.colorKey,
                share: link.share,
                zIndex: 100000 + index,
              })),
          },
        ],
      },
    ],
    categoryField: 'name',
    sourceField: 'source',
    targetField: 'target',
    valueField: 'value',
    nodeKey: 'key',
    direction: 'horizontal',
    nodeAlign: 'justify',
    linkSortBy: (a, b) =>
      numberValue(b.value) - numberValue(a.value) ||
      `${a.source || ''}\u0000${a.target || ''}`.localeCompare(
        `${b.source || ''}\u0000${b.target || ''}`,
      ) ||
      numberValue(a.index) - numberValue(b.index),
    nodeGap: 14,
    nodeWidth: 16,
    minLinkHeight: 2,
    minNodeHeight: 8,
    title: {
      visible: false,
      text: title,
    },
    legends: { visible: false },
    label: {
      visible: true,
      position: 'outside',
      limit: 220,
      interactive: false,
      style: {
        fill: '#475569',
        fontSize: 11,
        fontWeight: 600,
      },
    },
    node: {
      interactive: true,
      style: {
        fill: (datum) => String(sankeyDatumValue(datum, 'color') || colorAt(0)),
        fillOpacity: () => 0.92,
        stroke: 'rgba(148, 163, 184, 0.45)',
        lineWidth: 1,
        cursor: 'pointer',
        pickMode: 'accurate',
      },
      state: {
        hover: {
          fillOpacity: 1,
          stroke: 'rgba(15, 23, 42, 0.68)',
          lineWidth: 1.5,
        },
        selected: {
          fillOpacity: 1,
          stroke: 'rgba(15, 23, 42, 0.68)',
          lineWidth: 1.5,
        },
        blur: {
          fillOpacity: 0.22,
        },
      },
    },
    link: {
      interactive: true,
      style: {
        fill: (datum) =>
          String(
            sankeyDatumValue(datum, 'linkColor') ||
              sankeyDatumValue(datum, 'color') ||
              colorAt(0),
          ),
        fillOpacity: (datum) =>
          numberValue(sankeyDatumValue(datum, 'linkAlpha')) || 1,
        cursor: 'pointer',
        pickMode: 'accurate',
        boundsMode: 'accurate',
        zIndex: (datum) => {
          const zIndex = sankeyDatumValue(datum, 'zIndex');
          if (zIndex !== undefined) return numberValue(zIndex);
          return 1000000000 - numberValue(sankeyDatumValue(datum, 'value'));
        },
      },
      state: {
        hover: {
          fill: (datum) =>
            String(
              sankeyDatumValue(datum, 'hoverColor') ||
                sankeyDatumValue(datum, 'color') ||
                colorAt(0),
            ),
          fillOpacity: 0.9,
        },
        selected: {
          fill: (datum) =>
            String(
              sankeyDatumValue(datum, 'hoverColor') ||
                sankeyDatumValue(datum, 'color') ||
                colorAt(0),
            ),
          fillOpacity: 0.9,
        },
        blur: {
          fillOpacity: 0.22,
        },
      },
    },
    // 关闭内置点击强调：VChart 桑基的 related 处理器在点击时会崩溃，
    // 节点级筛选已由节点筛选下拉覆盖。
    emphasis: { enable: false },
    tooltip: {
      trigger: 'hover',
      activeType: 'mark',
      dimension: { visible: false },
      group: { visible: false },
      mark: {
        checkOverlap: true,
        positionMode: 'pointer',
        visible: (datum) =>
          (sankeyDatumValue(datum, 'source') !== undefined &&
            sankeyDatumValue(datum, 'target') !== undefined) ||
          sankeyDatumValue(datum, 'key') !== undefined,
        title: {
          value: (datum) => {
            const source = sankeyDatumValue(datum, 'source');
            const target = sankeyDatumValue(datum, 'target');
            if (source && target) {
              const sourceLabel = sankeyDatumValue(datum, 'sourceLabel');
              const targetLabel = sankeyDatumValue(datum, 'targetLabel');
              return `${sourceLabel || source} -> ${targetLabel || target}`;
            }
            return `${sankeyDatumValue(datum, 'name') || sankeyDatumValue(datum, 'rawLabel') || ''}`;
          },
        },
        content: tooltipMetricLines(valueFormatter, labels),
      },
    },
    background: { fill: 'transparent' },
    animation: false,
  };
}
