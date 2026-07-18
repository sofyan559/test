<?php
/**
 * Plugin Name: EG Arduino Simulator
 * Description: Visual Arduino and electronics simulator with Wokwi Elements, real community custom chips, Fritzing breadboards, movable wires, and an Arduino-style code editor.
 * Version: 2.0.8
 * Author: Engineering Geniuses
 * Text Domain: eg-arduino-simulator
 */

if (!defined('ABSPATH')) {
    exit;
}

final class EG_Arduino_Simulator_208 {
    public const VERSION = '2.0.8';
    private const NONCE_ACTION = 'egas_asset_proxy';

    /** @var string[] */
    private static array $allowed_repositories = [
        'wokwi/wokwi-docs',
        'wokwi/wokwi-elements',
        'fritzing/fritzing-parts',
        'drf5n/Wokwi-Chip-L298N',
        'drf5n/Wokwi-Chip-TB6612FNG',
        'drf5n/Wokwi-Chip-stepper-esc',
        'drf5n/Wokwi-Chip-FrequencyCounter',
        'drf5n/Wokwi-Chip-Schmitt-Trigger',
        'drf5n/Wokwi-Chip-LimitCounter',
        'bonnyr/wokwi-bme280-custom-chip',
        'bonnyr/wokwi-ds1820-custom-chip',
        'fido974/wokwi-aht25-custom-chip',
        'martysweet/st7735-wokwi-chip',
        'djedu28/wokwi-rdm6300-custom-chip',
        'anton21m/wokwi-rc522-rfid-chip',
        'wokwi/esp32c6-i2c-lp',
    ];

    public static function boot(): void {
        add_action('wp_enqueue_scripts', [self::class, 'register_assets']);
        add_shortcode('eg_arduino_simulator', [self::class, 'shortcode']);
        add_shortcode('egas', [self::class, 'shortcode']);
        add_action('wp_ajax_egas_asset', [self::class, 'asset_proxy']);
        add_action('wp_ajax_nopriv_egas_asset', [self::class, 'asset_proxy']);
    }

    public static function register_assets(): void {
        $base = plugin_dir_url(__FILE__);

        wp_register_style(
            'egas-codemirror',
            'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css',
            [],
            '5.65.16'
        );
        wp_register_style(
            'egas-codemirror-theme',
            'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/eclipse.min.css',
            ['egas-codemirror'],
            '5.65.16'
        );
        wp_register_style(
            'egas-app',
            $base . 'assets/css/app.css',
            ['egas-codemirror', 'egas-codemirror-theme'],
            self::VERSION
        );

        wp_register_script(
            'egas-wokwi-elements',
            'https://unpkg.com/@wokwi/elements@1.9.2/dist/wokwi-elements.bundle.min.js',
            [],
            '1.9.2',
            true
        );
        wp_register_script(
            'egas-codemirror',
            'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js',
            [],
            '5.65.16',
            true
        );
        wp_register_script(
            'egas-codemirror-clike',
            'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/clike/clike.min.js',
            ['egas-codemirror'],
            '5.65.16',
            true
        );
        wp_register_script(
            'egas-codemirror-closebrackets',
            'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/closebrackets.min.js',
            ['egas-codemirror'],
            '5.65.16',
            true
        );
        wp_register_script(
            'egas-catalog',
            $base . 'assets/js/catalog.js',
            [],
            self::VERSION,
            true
        );
        wp_register_script(
            'egas-app',
            $base . 'assets/js/app.js',
            [
                'egas-wokwi-elements',
                'egas-codemirror',
                'egas-codemirror-clike',
                'egas-codemirror-closebrackets',
                'egas-catalog',
            ],
            self::VERSION,
            true
        );
    }

    public static function shortcode(array $atts = []): string {
        wp_enqueue_style('egas-app');
        wp_enqueue_script('egas-app');

        $instance = 'egas-' . wp_generate_uuid4();
        $proxy_url = admin_url('admin-ajax.php');
        $settings = [
            'instanceId' => $instance,
            'version' => self::VERSION,
            'ajaxUrl' => $proxy_url,
            'assetNonce' => wp_create_nonce(self::NONCE_ACTION),
            'brand' => [
                'red' => '#e6332a',
                'yellow' => '#ffc400',
                'purple' => '#6f2dbd',
            ],
        ];

        wp_add_inline_script(
            'egas-app',
            'window.EGAS_INSTANCES = window.EGAS_INSTANCES || {}; window.EGAS_INSTANCES[' . wp_json_encode($instance) . '] = ' . wp_json_encode($settings) . ';',
            'before'
        );

        ob_start();
        ?>
        <section id="<?php echo esc_attr($instance); ?>" class="egas-app" data-egas-instance="<?php echo esc_attr($instance); ?>">
            <header class="egas-topbar">
                <div class="egas-brand">
                    <span class="egas-brand-mark" aria-hidden="true">EG</span>
                    <span>
                        <strong>Arduino Simulator</strong>
                        <small>Real parts &amp; community chips</small>
                    </span>
                </div>
                <div class="egas-project-actions">
                    <button type="button" data-action="new" title="New project">New</button>
                    <button type="button" data-action="undo" title="Undo">Undo</button>
                    <button type="button" data-action="redo" title="Redo">Redo</button>
                    <button type="button" data-action="save" title="Save in this browser">Save</button>
                    <button type="button" data-action="export" title="Export project JSON">Export</button>
                    <label class="egas-file-button" title="Import project JSON">Import<input type="file" data-action="import" accept="application/json,.json"></label>
                    <button type="button" data-action="fit" title="Fit all components">Fit</button>
                </div>
                <div class="egas-run-actions">
                    <button type="button" class="egas-run" data-action="run">Run</button>
                    <button type="button" class="egas-stop" data-action="stop" disabled>Stop</button>
                </div>
            </header>

            <div class="egas-layout">
                <aside class="egas-library-panel">
                    <div class="egas-panel-heading">
                        <strong>Components</strong>
                        <span data-role="library-count">0</span>
                    </div>
                    <label class="egas-search">
                        <span aria-hidden="true">⌕</span>
                        <input type="search" data-role="component-search" placeholder="Search boards, sensors, motors…" autocomplete="off">
                    </label>
                    <div class="egas-category-tabs" data-role="category-tabs"></div>
                    <div class="egas-library" data-role="component-library"></div>
                </aside>

                <main class="egas-stage-column">
                    <div class="egas-stage-toolbar">
                        <span class="egas-mode-status" data-role="mode-status">Select or drag a component</span>
                        <div>
                            <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
                            <span data-role="zoom-label">100%</span>
                            <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
                            <button type="button" data-action="reset-view">Reset view</button>
                            <button type="button" data-action="toggle-grid" class="is-active">Grid</button>
                        </div>
                    </div>
                    <div class="egas-stage" data-role="stage" tabindex="0">
                        <div class="egas-world" data-role="world">
                            <div class="egas-component-layer" data-role="component-layer"></div>
                            <svg class="egas-wire-layer" data-role="wire-layer" xmlns="http://www.w3.org/2000/svg">
                                <g data-role="wire-paths"></g>
                                <g data-role="wire-handles"></g>
                                <path data-role="draft-wire" class="egas-draft-wire" d=""></path>
                            </svg>
                            <div class="egas-pin-layer" data-role="pin-layer"></div>
                            <div class="egas-selection-layer" data-role="selection-layer"></div>
                        </div>
                        <div class="egas-stage-help">
                            <kbd>Right drag</kbd> pan · <kbd>Wheel</kbd> zoom · click a pin, click canvas for elbows, then click another pin
                        </div>
                    </div>
                </main>

                <aside class="egas-right-panel">
                    <div class="egas-tabs" role="tablist">
                        <button type="button" class="is-active" data-tab="code">Code</button>
                        <button type="button" data-tab="inspector">Inspector</button>
                        <button type="button" data-tab="serial">Serial</button>
                    </div>
                    <section class="egas-tab-panel is-active" data-panel="code">
                        <div class="egas-code-toolbar">
                            <select data-role="example-select" aria-label="Examples"></select>
                            <button type="button" data-action="load-example">Load example</button>
                        </div>
                        <textarea data-role="code-editor" spellcheck="false"></textarea>
                        <div class="egas-compile-status" data-role="compile-status">Ready</div>
                    </section>
                    <section class="egas-tab-panel" data-panel="inspector">
                        <div class="egas-empty-inspector" data-role="empty-inspector">Select a component or wire.</div>
                        <div class="egas-inspector" data-role="inspector"></div>
                    </section>
                    <section class="egas-tab-panel" data-panel="serial">
                        <div class="egas-serial-toolbar">
                            <strong>Serial Monitor</strong>
                            <button type="button" data-action="clear-serial">Clear</button>
                        </div>
                        <pre class="egas-serial" data-role="serial-output"></pre>
                    </section>
                </aside>
            </div>

            <div class="egas-toast-region" data-role="toasts" aria-live="polite"></div>
        </section>
        <?php
        return (string) ob_get_clean();
    }

    public static function asset_proxy(): void {
        $nonce = isset($_GET['nonce']) ? sanitize_text_field(wp_unslash($_GET['nonce'])) : '';
        if (!wp_verify_nonce($nonce, self::NONCE_ACTION)) {
            status_header(403);
            exit('Invalid asset token');
        }

        $repo = isset($_GET['repo']) ? sanitize_text_field(wp_unslash($_GET['repo'])) : '';
        $path = isset($_GET['path']) ? rawurldecode((string) wp_unslash($_GET['path'])) : '';
        $ref = isset($_GET['ref']) ? sanitize_text_field(wp_unslash($_GET['ref'])) : 'main';

        if (!in_array($repo, self::$allowed_repositories, true)) {
            status_header(403);
            exit('Repository is not allowed');
        }

        if (!preg_match('#^[A-Za-z0-9._/ +@()\-]+$#', $path) || str_contains($path, '..')) {
            status_header(400);
            exit('Invalid path');
        }

        if (!preg_match('/\.(json|svg|wasm|md|txt|xml|fzp|png|jpg|jpeg|webp)$/i', $path)) {
            status_header(400);
            exit('Unsupported file type');
        }

        if (!preg_match('/^[A-Za-z0-9._\/-]+$/', $ref)) {
            status_header(400);
            exit('Invalid ref');
        }

        $cache_key = 'egas_asset_' . sha1($repo . '|' . $ref . '|' . $path);
        $cached = get_transient($cache_key);
        if (is_array($cached) && isset($cached['body'], $cached['type'])) {
            self::output_asset((string) $cached['body'], (string) $cached['type']);
        }

        $url = sprintf(
            'https://raw.githubusercontent.com/%s/%s/%s',
            $repo,
            rawurlencode($ref),
            str_replace('%2F', '/', rawurlencode($path))
        );

        $response = wp_remote_get($url, [
            'timeout' => 18,
            'redirection' => 3,
            'headers' => ['User-Agent' => 'EG-Arduino-Simulator/' . self::VERSION],
            'limit_response_size' => 3 * MB_IN_BYTES,
        ]);

        if (is_wp_error($response)) {
            status_header(502);
            exit('Could not load component asset');
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        $body = (string) wp_remote_retrieve_body($response);
        if ($status !== 200 || $body === '') {
            status_header($status === 404 ? 404 : 502);
            exit('Component asset not found');
        }

        $type = self::content_type_for_path($path);
        set_transient($cache_key, ['body' => $body, 'type' => $type], 12 * HOUR_IN_SECONDS);
        self::output_asset($body, $type);
    }

    private static function content_type_for_path(string $path): string {
        $extension = strtolower((string) pathinfo($path, PATHINFO_EXTENSION));
        return match ($extension) {
            'json' => 'application/json; charset=utf-8',
            'svg' => 'image/svg+xml; charset=utf-8',
            'wasm' => 'application/wasm',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'xml', 'fzp' => 'application/xml; charset=utf-8',
            default => 'text/plain; charset=utf-8',
        };
    }

    private static function output_asset(string $body, string $type): void {
        nocache_headers();
        header('Content-Type: ' . $type);
        header('X-Content-Type-Options: nosniff');
        header('Cross-Origin-Resource-Policy: same-origin');
        echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        exit;
    }
}

EG_Arduino_Simulator_208::boot();
