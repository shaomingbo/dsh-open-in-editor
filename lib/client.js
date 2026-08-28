window.__ModuleLoader__.load({
  id: 'dsh-open-in-editor',
  factory: (require) => {
    const React = require('react')
    const { resolveWorkspacePath } = require('@deepseek-ai/dsh-client-runtime/client')
    const h = React.createElement
    const CHANNEL = '/open-in-editor'
    const NS = 'open-in-editor'
    const STYLE_ID = 'dsh-open-in-editor'
    const MAX_VISIBLE_FILES = 6

    const en = {
      nav: 'Open in IDE',
      settingsTitle: 'Default IDE',
      settingsIntro: 'Choose which local macOS application opens produced files. The arrow beside a file can copy its absolute path or choose another IDE for one open.',
      system: 'System default',
      installed: 'Installed',
      unavailable: 'Not installed',
      loading: 'Detecting applications…',
      refresh: 'Refresh applications',
      saveFailed: 'Could not save the default IDE.',
      openFailed: 'Could not open {name}: {message}',
      openDefault: 'Open {name} in the default IDE',
      choose: 'More actions for {name}',
      menu: 'Actions for {name}',
      copyPath: 'Copy absolute path',
      copied: 'Copied the path for {name}.',
      copyFailed: 'Could not copy {name}: {message}',
      openWith: 'Open with',
      more: '+{count} more',
      less: 'Show fewer',
      remote: 'This feature is available only from a loopback browser.',
      unsupported: 'This plugin currently supports macOS only.',
    }

    const zh = {
      nav: '打开方式',
      settingsTitle: '默认 IDE',
      settingsIntro: '选择用于打开产物文件的本地 macOS 应用。文件旁的箭头可复制绝对路径，或临时选择其他 IDE。',
      system: '系统默认',
      installed: '已安装',
      unavailable: '未安装',
      loading: '正在检测应用…',
      refresh: '刷新应用列表',
      saveFailed: '无法保存默认 IDE。',
      openFailed: '无法打开 {name}：{message}',
      openDefault: '使用默认 IDE 打开 {name}',
      choose: '{name} 的更多操作',
      menu: '{name} 的文件操作',
      copyPath: '复制绝对路径',
      copied: '已复制 {name} 的路径。',
      copyFailed: '无法复制 {name}：{message}',
      openWith: '打开方式',
      more: '另有 {count} 个',
      less: '收起',
      remote: '此功能仅可从本机回环地址打开的浏览器使用。',
      unsupported: '此插件目前仅支持 macOS。',
    }

    function ensureStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return
      const style = document.createElement('style')
      style.dataset.plugin = 'dsh-open-in-editor'
      style.dataset.pluginCss = STYLE_ID
      style.textContent = `
.dsh-open-in-editor-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-width:0;margin-top:8px}
.dsh-open-in-editor-split{display:inline-flex;align-items:stretch;min-width:0;height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.dsh-open-in-editor-main,.dsh-open-in-editor-arrow{box-sizing:border-box;border:0;color:var(--dsw-alias-label-secondary);background:transparent;font:inherit;cursor:pointer}
.dsh-open-in-editor-main{display:flex;align-items:center;gap:6px;min-width:0;max-width:260px;padding:3px 8px;font-size:12px;line-height:20px}
.dsh-open-in-editor-arrow{display:grid;place-items:center;width:27px;border-left:1px solid var(--dsw-alias-border-l2)}
.dsh-open-in-editor-main:hover:not(:disabled),.dsh-open-in-editor-arrow:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.dsh-open-in-editor-main:focus-visible,.dsh-open-in-editor-arrow:focus-visible,.dsh-open-in-editor-menu-item:focus-visible,.dsh-open-in-editor-option:focus-visible,.dsh-open-in-editor-refresh:focus-visible,.dsh-open-in-editor-more:focus-visible{outline:2px solid var(--dsw-alias-interactive-border-focus,currentColor);outline-offset:-2px}
.dsh-open-in-editor-main:disabled,.dsh-open-in-editor-arrow:disabled{cursor:default;opacity:.55}
.dsh-open-in-editor-file-icon,.dsh-open-in-editor-chevron-icon{display:block;flex:none;width:14px;height:14px}
.dsh-open-in-editor-copy-icon{box-sizing:border-box;display:block;flex:none;width:20px;height:20px;padding:2px;color:var(--dsw-alias-label-secondary)}
.dsh-open-in-editor-file-icon[data-busy=true]{animation:dsh-open-in-editor-spin .8s linear infinite}
@keyframes dsh-open-in-editor-spin{to{transform:rotate(360deg)}}
.dsh-open-in-editor-file-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-open-in-editor-more{box-sizing:border-box;height:28px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font:inherit;font-size:12px;line-height:28px;cursor:pointer}
.dsh-open-in-editor-more:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.dsh-open-in-editor-menu{box-sizing:border-box;z-index:1400;position:fixed;width:224px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv3);display:flex;flex-direction:column;gap:2px}
.dsh-open-in-editor-menu-title{padding:5px 8px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-open-in-editor-menu-separator{height:1px;margin:4px 2px;background:var(--dsw-alias-border-l2)}
.dsh-open-in-editor-menu-section{padding:4px 8px 2px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:11px}
.dsh-open-in-editor-menu-item{border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;display:flex;align-items:center;gap:9px;width:100%;padding:7px 8px;text-align:left;cursor:pointer}
.dsh-open-in-editor-menu-item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsh-open-in-editor-menu-item:disabled{cursor:not-allowed;opacity:.45}
.dsh-open-in-editor-app-icon{box-sizing:border-box;display:grid;place-items:center;flex:none;width:20px;height:20px;border-radius:5px;color:white;background:#64748b;font-size:10px;font-weight:600}
.dsh-open-in-editor-app-icon[data-editor=zed]{background:#111827}.dsh-open-in-editor-app-icon[data-editor=vscode]{background:#1685d1}.dsh-open-in-editor-app-icon[data-editor=xcode]{background:#2787e6}.dsh-open-in-editor-app-icon[data-editor=system]{background:#6b7280}
.dsh-open-in-editor-app-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-open-in-editor-app-state{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}
.dsh-open-in-editor-settings{max-width:620px;color:var(--dsw-alias-label-primary)}.dsh-open-in-editor-settings h2{margin:0 0 8px;font-size:20px;line-height:28px}.dsh-open-in-editor-settings p{margin:0 0 20px;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:22px}
.dsh-open-in-editor-options{display:flex;flex-direction:column;gap:8px}.dsh-open-in-editor-option{box-sizing:border-box;width:100%;min-height:52px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer}
.dsh-open-in-editor-option:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsh-open-in-editor-option[data-selected=true]{border-color:var(--dsw-static-neutral-bluish-400);background:var(--dsw-alias-bg-module-platform)}.dsh-open-in-editor-option:disabled{cursor:not-allowed;opacity:.48}
.dsh-open-in-editor-settings-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px}.dsh-open-in-editor-refresh{border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;padding:7px 9px;cursor:pointer}.dsh-open-in-editor-refresh:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-open-in-editor-error{color:var(--dsw-alias-status-error,#dc2626);font-size:12px}.dsh-open-in-editor-muted{color:var(--dsw-alias-label-secondary);font-size:13px}
`
      document.head.appendChild(style)
    }

    function createCatalog(connection) {
      let state = { status: 'idle', editors: [], supported: true, error: null }
      let inflight
      const listeners = new Set()
      const publish = (next) => {
        state = next
        listeners.forEach((listener) => listener())
      }
      const load = (refresh = false) => {
        if (!refresh && state.status === 'ready') return Promise.resolve(state)
        if (!refresh && inflight !== undefined) return inflight
        publish({ ...state, status: 'loading', error: null })
        inflight = connection.rpc.call(CHANNEL, 'describe', { refresh }).then((result) => {
          if (!result.ok) throw new Error(result.error.message)
          const next = {
            status: 'ready',
            editors: result.value.editors,
            supported: result.value.supported,
            error: null,
          }
          publish(next)
          return next
        }, (cause) => {
          const message = cause instanceof Error ? cause.message : 'Application detection failed.'
          const next = { ...state, status: 'error', error: message }
          publish(next)
          return next
        }).finally(() => {
          inflight = undefined
        })
        return inflight
      }
      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        load,
      }
    }

    function useExternalStore(store) {
      const subscribe = React.useCallback((listener) => store.subscribe(listener), [store])
      const getSnapshot = React.useCallback(() => store.getSnapshot(), [store])
      return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    }

    function producedForClosing(data, seq = Number.POSITIVE_INFINITY) {
      if (data === undefined || !Array.isArray(data.produced)) return []
      const result = []
      const seen = new Set()
      for (const item of data.produced) {
        if (typeof item?.path !== 'string' || item.seq > seq || seen.has(item.path)) continue
        seen.add(item.path)
        result.push(item.path)
      }
      return result
    }

    function selectProducedFiles(owner) {
      const paths = producedForClosing(owner.turn.data.get('deliverables'), owner.seq)
      return paths.length === 0 ? null : paths
    }

    function fileName(path) {
      const pieces = path.replaceAll('\\', '/').split('/').filter(Boolean)
      return pieces.at(-1) ?? path
    }

    function editorGlyph(id) {
      if (id === 'system') return '⌘'
      if (id === 'vscode') return 'VS'
      if (id === 'xcode') return 'X'
      return 'Z'
    }

    function AppIcon({ editor }) {
      return h('span', {
        className: 'dsh-open-in-editor-app-icon',
        'data-editor': editor.id,
        'aria-hidden': 'true',
      }, editorGlyph(editor.id))
    }

    function FileIcon({ busy }) {
      if (busy) {
        return h('svg', {
          className: 'dsh-open-in-editor-file-icon',
          'data-busy': 'true',
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
        },
        h('circle', { cx: 8, cy: 8, r: 5, stroke: 'currentColor', strokeWidth: 1.25, opacity: 0.28 }),
        h('path', { d: 'M8 3a5 5 0 0 1 5 5', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }))
      }
      return h('svg', {
        className: 'dsh-open-in-editor-file-icon',
        'data-busy': 'false',
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
      },
      h('path', { d: 'M4 2.5h5l3 3v8H4z', stroke: 'currentColor', strokeWidth: 1.25, strokeLinejoin: 'round' }),
      h('path', { d: 'M9 2.5v3h3', stroke: 'currentColor', strokeWidth: 1.25, strokeLinejoin: 'round' }))
    }

    function ChevronIcon() {
      return h('svg', {
        className: 'dsh-open-in-editor-chevron-icon',
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
      }, h('path', {
        d: 'M4.5 6.25 8 9.75l3.5-3.5',
        stroke: 'currentColor',
        strokeWidth: 1.25,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }))
    }

    function CopyIcon() {
      return h('svg', {
        className: 'dsh-open-in-editor-copy-icon',
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
      },
      h('rect', { x: 5, y: 5, width: 8, height: 8, rx: 1.25, stroke: 'currentColor', strokeWidth: 1.25 }),
      h('path', { d: 'M10.5 5V4.25A1.25 1.25 0 0 0 9.25 3h-6A1.25 1.25 0 0 0 2 4.25v6A1.25 1.25 0 0 0 3.25 11H5', stroke: 'currentColor', strokeWidth: 1.25, strokeLinecap: 'round' }))
    }

    async function copyWorkspacePath(cwd, path, clipboard = globalThis.navigator?.clipboard) {
      const absolute = resolveWorkspacePath(cwd, path)
      if (typeof clipboard?.writeText !== 'function') throw new Error('Clipboard API is unavailable.')
      await clipboard.writeText(absolute)
      return absolute
    }

    async function requestOpen(connection, path, editor) {
      const payload = { path }
      if (editor !== undefined) payload.editor = editor
      const result = await connection.rpc.call(CHANNEL, 'open', payload)
      if (!result.ok) throw new Error(result.error.message)
      return result.value
    }

    function OpenMenu({ menu, catalog, pending, onCopy, onOpen, onClose, t }) {
      const state = useExternalStore(catalog)
      const menuRef = React.useRef(null)

      React.useEffect(() => {
        void catalog.load()
      }, [catalog])

      React.useEffect(() => {
        const onPointer = (event) => {
          if (!menuRef.current?.contains(event.target) && !menu.anchor?.contains(event.target)) onClose(true)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose(true)
          }
        }
        document.addEventListener('pointerdown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('pointerdown', onPointer)
          document.removeEventListener('keydown', onKey)
        }
      }, [menu.anchor, onClose])

      const width = 224
      const left = Math.max(8, Math.min(menu.left, window.innerWidth - width - 8))
      return h('div', {
        ref: menuRef,
        className: 'dsh-open-in-editor-menu',
        role: 'menu',
        'aria-label': t('menu', { name: fileName(menu.path) }),
        style: { left, top: menu.top },
      },
      h('div', { className: 'dsh-open-in-editor-menu-title' }, fileName(menu.path)),
      h('button', {
        type: 'button',
        role: 'menuitem',
        className: 'dsh-open-in-editor-menu-item',
        'data-action': 'copy-path',
        onClick: () => onCopy(menu.path),
      }, h(CopyIcon), h('span', { className: 'dsh-open-in-editor-app-label' }, t('copyPath'))),
      h('div', { className: 'dsh-open-in-editor-menu-separator', role: 'separator' }),
      h('div', { className: 'dsh-open-in-editor-menu-section' }, t('openWith')),
      state.status === 'loading' || state.status === 'idle'
        ? h('div', { className: 'dsh-open-in-editor-muted', style: { padding: '8px' } }, t('loading'))
        : state.editors.map((editor) => h('button', {
          key: editor.id,
          type: 'button',
          role: 'menuitem',
          className: 'dsh-open-in-editor-menu-item',
          disabled: !editor.available || pending,
          onClick: () => onOpen(menu.path, editor.id),
        }, h(AppIcon, { editor }),
        h('span', { className: 'dsh-open-in-editor-app-label' }, editor.id === 'system' ? t('system') : editor.name),
        !editor.available ? h('span', { className: 'dsh-open-in-editor-app-state' }, t('unavailable')) : null)),
      state.error ? h('div', { className: 'dsh-open-in-editor-error', style: { padding: '8px' } }, state.error) : null)
    }

    function ProducedFiles({ matched: paths, sessionId, useSessions, inputActions, connection, catalog, t }) {
      const cwd = useSessions((state) => state.byId?.[sessionId]?.cwd)
      const [pending, setPending] = React.useState(null)
      const [menu, setMenu] = React.useState(null)
      const [expanded, setExpanded] = React.useState(false)
      const alive = React.useRef(true)

      React.useEffect(() => {
        alive.current = true
        return () => {
          alive.current = false
        }
      }, [])

      const closeMenu = React.useCallback((restoreFocus = false) => {
        if (restoreFocus) menu?.anchor?.focus?.()
        setMenu(null)
      }, [menu])

      const openPath = React.useCallback(async (path, editor) => {
        const absolute = resolveWorkspacePath(cwd, path)
        setPending(path)
        closeMenu(false)
        try {
          await requestOpen(connection, absolute, editor)
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Open failed.'
          inputActions?.notify?.('error', t('openFailed', { name: fileName(path), message }))
        } finally {
          if (alive.current) setPending(null)
        }
      }, [closeMenu, connection, cwd, inputActions, t])

      const copyPath = React.useCallback(async (path) => {
        try {
          await copyWorkspacePath(cwd, path)
          inputActions?.notify?.('success', t('copied', { name: fileName(path) }))
          closeMenu(true)
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Copy failed.'
          inputActions?.notify?.('error', t('copyFailed', { name: fileName(path), message }))
        }
      }, [closeMenu, cwd, inputActions, t])

      const showMenu = React.useCallback((event, path) => {
        const rect = event.currentTarget.getBoundingClientRect()
        setMenu({ path, left: rect.right - 224, top: rect.bottom + 5, anchor: event.currentTarget })
        void catalog.load()
      }, [catalog])

      const visible = expanded ? paths : paths.slice(0, MAX_VISIBLE_FILES)
      return h('div', { className: 'dsh-open-in-editor-row' },
        visible.map((path) => {
          const name = fileName(path)
          const busy = pending === path
          return h('span', { className: 'dsh-open-in-editor-split', key: path },
            h('button', {
              type: 'button',
              className: 'dsh-open-in-editor-main',
              disabled: pending !== null,
              title: t('openDefault', { name }),
              'aria-label': t('openDefault', { name }),
              onClick: () => openPath(path),
            }, h(FileIcon, { busy }),
            h('span', { className: 'dsh-open-in-editor-file-name' }, name)),
            h('button', {
              type: 'button',
              className: 'dsh-open-in-editor-arrow',
              disabled: pending !== null,
              title: t('choose', { name }),
              'aria-label': t('choose', { name }),
              'aria-haspopup': 'menu',
              'aria-expanded': menu?.path === path,
              onClick: (event) => menu?.path === path ? closeMenu(false) : showMenu(event, path),
            }, h(ChevronIcon)))
        }),
        paths.length > MAX_VISIBLE_FILES
          ? h('button', {
            type: 'button',
            className: 'dsh-open-in-editor-more',
            'aria-expanded': expanded,
            onClick: () => setExpanded((value) => !value),
          }, expanded ? t('less') : t('more', { count: paths.length - MAX_VISIBLE_FILES }))
          : null,
        menu === null ? null : h(OpenMenu, {
          menu,
          catalog,
          pending: pending !== null,
          onCopy: copyPath,
          onOpen: openPath,
          onClose: closeMenu,
          t,
        }))
    }

    function SettingsSection({ settings, catalog, connection, t }) {
      const snapshot = useExternalStore(settings)
      const applications = useExternalStore(catalog)
      const [saving, setSaving] = React.useState(false)
      const [error, setError] = React.useState(null)

      React.useEffect(() => {
        void catalog.load()
      }, [catalog])

      const selected = snapshot.value?.defaultEditor ?? 'system'
      const choose = async (id) => {
        if (saving || id === selected) return
        setSaving(true)
        setError(null)
        try {
          await settings.set('defaultEditor', id)
          if (settings.getSnapshot().value?.defaultEditor !== id) {
            throw new Error(t('saveFailed'))
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : t('saveFailed'))
        } finally {
          setSaving(false)
        }
      }

      if (!connection.isLoopback) {
        return h('section', { className: 'dsh-open-in-editor-settings' },
          h('h2', null, t('settingsTitle')),
          h('p', null, t('remote')))
      }

      return h('section', { className: 'dsh-open-in-editor-settings' },
        h('h2', null, t('settingsTitle')),
        h('p', null, t('settingsIntro')),
        applications.supported === false
          ? h('div', { className: 'dsh-open-in-editor-error' }, t('unsupported'))
          : null,
        h('div', { className: 'dsh-open-in-editor-options', role: 'radiogroup', 'aria-label': t('settingsTitle') },
          applications.status === 'idle' || applications.status === 'loading'
            ? h('div', { className: 'dsh-open-in-editor-muted' }, t('loading'))
            : applications.editors.map((editor) => h('button', {
              key: editor.id,
              type: 'button',
              role: 'radio',
              'aria-checked': selected === editor.id,
              className: 'dsh-open-in-editor-option',
              'data-selected': selected === editor.id,
              disabled: saving || !snapshot.writable || !editor.available,
              onClick: () => choose(editor.id),
            }, h(AppIcon, { editor }),
            h('span', { className: 'dsh-open-in-editor-app-label' }, editor.id === 'system' ? t('system') : editor.name),
            h('span', { className: 'dsh-open-in-editor-app-state' }, editor.available ? t('installed') : t('unavailable'))))),
        h('div', { className: 'dsh-open-in-editor-settings-footer' },
          h('button', {
            type: 'button',
            className: 'dsh-open-in-editor-refresh',
            disabled: applications.status === 'loading',
            onClick: () => { void catalog.load(true) },
          }, t('refresh')),
          error || applications.error ? h('span', { className: 'dsh-open-in-editor-error' }, error ?? applications.error) : null))
    }

    const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

    function apply(ctx) {
      ensureStyles()
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'open-in-editor: browser dictionaries')
      const catalog = createCatalog(ctx.connection)
      const settings = ctx.settingsScope.bind({ namespace: NS })

      ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
        name: 'conversation.chat.turnTail',
        priority: -100,
        select: ctx.connection.isLoopback ? selectProducedFiles : () => null,
        locale: NS,
      }, (props) => h(ProducedFiles, { ...props, connection: ctx.connection, catalog })))

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'open-in-editor',
        order: 15,
        label: () => ctx.locale.bind(NS)('nav'),
        locale: NS,
      }, (props) => h(SettingsSection, {
        ...props,
        settings,
        catalog,
        connection: ctx.connection,
      })))
    }

    return {
      apply,
      inject,
      copyWorkspacePath,
      createCatalog,
      fileName,
      producedForClosing,
      requestOpen,
      selectProducedFiles,
    }
  },
})
