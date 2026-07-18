(function () {
  'use strict';

  const wokwi = (id, label, category, tag, width, height, keywords = [], attrs = {}) => ({
    id, label, category, kind: 'wokwi', tag, width, height, keywords, attrs,
    source: 'Official Wokwi Elements 1.9.2',
    license: 'MIT'
  });

  const custom = (id, label, category, repo, options = {}) => ({
    id, label, category, kind: 'custom', repo,
    ref: options.ref || 'main',
    manifestCandidates: options.manifestCandidates || ['chip.json', 'chip/chip.json', 'wokwi-custom-chip.json'],
    svgCandidates: options.svgCandidates || ['chip.svg', 'chip/chip.svg', 'docs/chip.svg'],
    width: options.width || 170,
    height: options.height || 110,
    keywords: options.keywords || [],
    fallbackPins: options.fallbackPins || [],
    source: options.source || `GitHub: ${repo}`,
    license: options.license || 'Repository license',
    behavior: options.behavior || 'manifest'
  });

  const fritzing = (id, label, category, path, options = {}) => ({
    id, label, category, kind: 'fritzing', repo: 'fritzing/fritzing-parts', ref: 'develop', path,
    width: options.width || 190,
    height: options.height || 120,
    keywords: options.keywords || [],
    source: 'Official Fritzing Parts Library',
    license: 'CC BY-SA 3.0',
    isBreadboard: !!options.isBreadboard
  });

  const special = (id, label, category, renderer, options = {}) => ({
    id, label, category, kind: 'special', renderer,
    width: options.width || 190,
    height: options.height || 120,
    keywords: options.keywords || [],
    pins: options.pins || [],
    source: options.source || 'EG interactive component',
    license: options.license || 'Plugin asset'
  });

  const components = [
    wokwi('arduino-uno', 'Arduino Uno R3', 'Boards', 'wokwi-arduino-uno', 274, 202, ['atmega328p', 'uno']),
    wokwi('arduino-mega', 'Arduino Mega 2560', 'Boards', 'wokwi-arduino-mega', 400, 215, ['atmega2560', 'mega']),
    wokwi('arduino-nano', 'Arduino Nano', 'Boards', 'wokwi-arduino-nano', 150, 190, ['atmega328p', 'nano']),
    wokwi('esp32-devkit', 'ESP32 DevKit V1', 'Boards', 'wokwi-esp32-devkit-v1', 150, 250, ['wifi', 'bluetooth', 'esp32']),
    wokwi('pi-pico', 'Raspberry Pi Pico', 'Boards', 'wokwi-pi-pico', 145, 290, ['rp2040', 'pico']),
    wokwi('nano-rp2040', 'Arduino Nano RP2040 Connect', 'Boards', 'wokwi-nano-rp2040-connect', 150, 210, ['rp2040', 'nano']),
    wokwi('franzininho', 'Franzininho DIY', 'Boards', 'wokwi-franzininho-diymore', 150, 120, ['attiny85']),
    wokwi('attiny85', 'ATtiny85', 'Boards', 'wokwi-attiny85', 115, 105, ['avr', 'dip']),

    special('l298n-real', 'L298N Dual Motor Driver', 'Motor Drivers', 'l298n', {
      width: 255, height: 205, keywords: ['h bridge', 'motor driver', 'dual h bridge'],
      source: 'Interactive L298N body using the Wokwi community-chip pin model',
      pins: [
        ['ENA', 14, 28], ['IN1', 14, 54], ['IN2', 14, 80], ['IN3', 14, 126], ['IN4', 14, 152], ['ENB', 14, 178],
        ['OUT1', 241, 34], ['OUT2', 241, 66], ['OUT3', 241, 139], ['OUT4', 241, 171],
        ['12V', 76, 194], ['GND', 127, 194], ['5V', 179, 194]
      ]
    }),
    special('tt-motor-real', 'TT Yellow Gear Motor', 'Motors', 'ttmotor', {
      width: 250, height: 138, keywords: ['dc motor', 'gear motor', 'robot car', 'yellow motor'],
      source: 'Interactive TT gear motor paired with the Wokwi stepper-ESC behavior model',
      pins: [['M+', 33, 113], ['M−', 67, 113]]
    }),
    custom('tb6612fng-community', 'TB6612FNG Community Chip', 'Motor Drivers', 'drf5n/Wokwi-Chip-TB6612FNG', {
      width: 190, height: 150, keywords: ['h bridge', 'motor driver'], behavior: 'wasm-ready'
    }),
    custom('stepper-esc-community', 'DC Motor ESC / Inertia Chip', 'Motor Drivers', 'drf5n/Wokwi-Chip-stepper-esc', {
      width: 180, height: 125, keywords: ['dc motor', 'pwm', 'inertia', 'speed'], behavior: 'wasm-ready'
    }),
    wokwi('a4988', 'A4988 Stepper Driver', 'Motor Drivers', 'wokwi-a4988', 130, 170, ['stepper', 'driver']),
    fritzing('drv8825', 'DRV8825 Stepper Driver', 'Motor Drivers', 'core/DRV8825_breakout_1be7926_002.fzp', {width: 125, height: 180, keywords: ['stepper', 'driver']}),
    fritzing('easydriver', 'EasyDriver V4.4', 'Motor Drivers', 'core/EasyDriver_v44.fzp', {width: 220, height: 170, keywords: ['stepper']}),
    fritzing('arduino-motor-shield', 'Arduino Motor Shield Rev3', 'Motor Drivers', 'core/Arduino_Motor_Shield_rev3.fzp', {width: 270, height: 205, keywords: ['l298', 'shield']}),
    fritzing('dual-vnh2sp30', 'Dual VNH2SP30 Driver', 'Motor Drivers', 'core/Dual_VNH2SP30_Motor_Driver_23a2baa_2.fzp', {width: 260, height: 170, keywords: ['high current', 'motor driver']}),
    fritzing('tb6612-breakout', 'TB6612FNG Breakout', 'Motor Drivers', 'core/sparkfun-poweric-tb6621fng-.fzp', {width: 190, height: 145, keywords: ['motor driver']}),
    fritzing('wemos-motor-shield', 'Wemos D1 Motor Shield', 'Motor Drivers', 'core/WeMos-D1-mini-Motor-Shield-no-headers.fzp', {width: 190, height: 150}),
    fritzing('irf520-module', 'IRF520 MOSFET Module', 'Motor Drivers', 'core/IFR520_MOS_module.fzp', {width: 175, height: 125, keywords: ['mosfet', 'load']}),

    wokwi('servo', 'Micro Servo', 'Motors', 'wokwi-servo', 170, 100, ['sg90', 'servo']),
    wokwi('stepper', 'Bipolar Stepper Motor', 'Motors', 'wokwi-stepper-motor', 165, 165, ['nema', 'stepper']),
    wokwi('biaxial-stepper', 'Biaxial Stepper', 'Motors', 'wokwi-biaxial-stepper', 165, 165),

    fritzing('half-breadboard-v2', 'Half Breadboard — 400 Points', 'Breadboards', 'core/Half_breadboard_v2.fzp', {width: 520, height: 320, keywords: ['prototype', 'solderless'], isBreadboard: true}),
    fritzing('half-breadboard', 'Classic Half Breadboard', 'Breadboards', 'core/halfBreadboard.fzp', {width: 500, height: 300, keywords: ['prototype'], isBreadboard: true}),
    fritzing('compact-breadboard', 'Compact Breadboard', 'Breadboards', 'core/halfMinusBreadboard.fzp', {width: 420, height: 250, keywords: ['mini'], isBreadboard: true}),
    fritzing('breadboard-power', 'Breadboard Power Supply', 'Power', 'core/Breadboard Power Supply - SMD v13.fzp', {width: 210, height: 120, keywords: ['mb102', '3.3v', '5v']}),
    fritzing('lm2596', 'LM2596 Adjustable Converter', 'Power', 'core/RioRand_LM2596_94ce9810d0922bc731e2f315085d46ab_1.fzp', {width: 230, height: 135, keywords: ['buck', 'converter']}),
    fritzing('power-screwshield', 'Power Screw Shield', 'Power', 'core/Power Screwshield 1.0a.fzp', {width: 280, height: 210}),

    wokwi('led', '5mm LED', 'Outputs', 'wokwi-led', 38, 70, ['light'], {color: 'red'}),
    wokwi('rgb-led', 'RGB LED', 'Outputs', 'wokwi-rgb-led', 55, 75, ['multicolor']),
    wokwi('led-bar', '10 Segment LED Bar', 'Outputs', 'wokwi-led-bar-graph', 160, 72, ['bargraph']),
    wokwi('neopixel', 'WS2812 NeoPixel', 'Outputs', 'wokwi-neopixel', 55, 55, ['ws2812', 'addressable']),
    wokwi('led-ring', 'NeoPixel Ring', 'Outputs', 'wokwi-led-ring', 135, 135, ['ws2812']),
    wokwi('led-matrix', 'NeoPixel Matrix', 'Outputs', 'wokwi-led-matrix', 170, 170, ['ws2812']),
    wokwi('buzzer', 'Piezo Buzzer', 'Outputs', 'wokwi-buzzer', 75, 75, ['sound']),
    wokwi('relay-module', 'Realistic Relay Module', 'Outputs', 'wokwi-relay-module', 185, 85, ['relay', 'spdt']),
    fritzing('omron-relay', 'Omron G5LE Relay', 'Outputs', 'core/OMRON_G5LE.fzp', {width: 145, height: 95, keywords: ['relay']}),
    fritzing('wemos-relay', 'Wemos Relay Shield', 'Outputs', 'core/WeMos-D1-mini-Relay-Shield-V2-no-headers.fzp', {width: 190, height: 150, keywords: ['relay']}),

    wokwi('lcd1602', 'LCD 16×2', 'Displays', 'wokwi-lcd1602', 240, 105, ['character lcd']),
    wokwi('lcd2004', 'LCD 20×4', 'Displays', 'wokwi-lcd2004', 260, 135, ['character lcd']),
    wokwi('ssd1306', 'SSD1306 OLED', 'Displays', 'wokwi-ssd1306', 135, 105, ['oled', 'i2c']),
    wokwi('ili9341', 'ILI9341 TFT', 'Displays', 'wokwi-ili9341', 190, 270, ['tft', 'spi']),
    wokwi('7segment', 'Seven Segment Display', 'Displays', 'wokwi-7segment', 85, 120, ['seven segment']),
    wokwi('tm1637', 'TM1637 4-Digit Display', 'Displays', 'wokwi-tm1637-7segment', 220, 110, ['clock display']),
    wokwi('max7219', 'MAX7219 Dot Matrix', 'Displays', 'wokwi-max7219-matrix', 170, 170, ['matrix', 'spi']),
    custom('st7735-community', 'ST7735 Community Display', 'Displays', 'martysweet/st7735-wokwi-chip', {width: 180, height: 245, keywords: ['tft', 'spi'], behavior: 'wasm-ready'}),
    fritzing('rgb-matrix', 'RGB LED Matrix', 'Displays', 'core/RGB_matrix_v25.fzp', {width: 260, height: 220, keywords: ['matrix']}),

    wokwi('pushbutton', 'Pushbutton 12mm', 'Inputs', 'wokwi-pushbutton', 70, 70, ['button']),
    wokwi('slide-switch', 'Slide Switch', 'Inputs', 'wokwi-slide-switch', 100, 60, ['spdt']),
    wokwi('dip-switch', '8-Way DIP Switch', 'Inputs', 'wokwi-dip-switch-8', 145, 75),
    wokwi('potentiometer', 'Rotary Potentiometer', 'Inputs', 'wokwi-potentiometer', 90, 90, ['analog']),
    wokwi('slide-pot', 'Slide Potentiometer', 'Inputs', 'wokwi-slide-potentiometer', 190, 65, ['analog']),
    wokwi('joystick', 'Analog Joystick', 'Inputs', 'wokwi-analog-joystick', 125, 125, ['xy']),
    wokwi('rotary-encoder', 'KY-040 Encoder', 'Inputs', 'wokwi-ky-040', 125, 110, ['rotary']),
    wokwi('keypad', '4×4 Membrane Keypad', 'Inputs', 'wokwi-membrane-keypad', 180, 220, ['keys']),

    wokwi('dht22', 'DHT22 Temperature & Humidity', 'Sensors', 'wokwi-dht22', 80, 115, ['humidity', 'temperature']),
    wokwi('ultrasonic', 'HC-SR04 Ultrasonic', 'Sensors', 'wokwi-hc-sr04', 180, 80, ['distance']),
    wokwi('pir', 'PIR Motion Sensor', 'Sensors', 'wokwi-pir-motion-sensor', 125, 125, ['motion']),
    wokwi('ntc', 'NTC Temperature Sensor', 'Sensors', 'wokwi-ntc-temperature-sensor', 115, 100, ['temperature', 'analog']),
    wokwi('photoresistor', 'Photoresistor Module', 'Sensors', 'wokwi-photoresistor-sensor', 120, 90, ['ldr', 'light']),
    wokwi('gas', 'MQ2 Gas Sensor', 'Sensors', 'wokwi-gas-sensor', 125, 110, ['smoke', 'gas']),
    wokwi('flame', 'Flame Sensor', 'Sensors', 'wokwi-flame-sensor', 120, 85, ['fire']),
    wokwi('sound', 'Sound Sensor', 'Sensors', 'wokwi-sound-sensor', 120, 85, ['microphone']),
    wokwi('mpu6050', 'MPU6050 IMU', 'Sensors', 'wokwi-mpu6050', 135, 105, ['gyro', 'accelerometer']),
    wokwi('hx711', 'HX711 Load Cell Amplifier', 'Sensors', 'wokwi-hx711', 185, 105, ['weight', 'load cell']),
    wokwi('heartbeat', 'Heartbeat Sensor', 'Sensors', 'wokwi-heartbeat-sensor', 120, 105, ['pulse']),
    custom('bme280-community', 'BME280 Community Chip', 'Sensors', 'bonnyr/wokwi-bme280-custom-chip', {
      manifestCandidates: ['chip/chip.json', 'chip/wokwi-custom-chip.json', 'chip.json'],
      svgCandidates: ['chip/chip.svg', 'chip.svg'], width: 155, height: 120,
      keywords: ['pressure', 'humidity', 'temperature', 'i2c', 'spi'], behavior: 'wasm-ready'
    }),
    custom('aht25-community', 'AHT25 Community Chip', 'Sensors', 'fido974/wokwi-aht25-custom-chip', {
      width: 150, height: 110, keywords: ['humidity', 'temperature', 'i2c'], behavior: 'wasm-ready'
    }),
    custom('ds18b20-community', 'DS18B20 Community Chip', 'Sensors', 'bonnyr/wokwi-ds1820-custom-chip', {
      manifestCandidates: ['chip/chip.json', 'chip.json'], svgCandidates: ['chip/chip.svg', 'chip.svg'],
      width: 100, height: 125, keywords: ['onewire', 'temperature'], behavior: 'wasm-ready'
    }),
    fritzing('ds18b20-fritzing', 'DS18B20 Waterproof / TO-92', 'Sensors', 'core/DS18B20.fzp', {width: 85, height: 125, keywords: ['temperature']}),
    fritzing('mpu9250', 'MPU-9250 IMU', 'Sensors', 'core/Sparkfun_IMU_Breakout_MPU-9250.fzp', {width: 170, height: 125, keywords: ['imu', 'gyro']}),
    fritzing('electret-mic', 'Amplified Electret Microphone', 'Sensors', 'core/amplified-mic-electret_15e7e05_002.fzp', {width: 145, height: 100, keywords: ['sound']}),
    fritzing('load-cell', 'Load Cell', 'Sensors', 'core/sparkfun-sensors-load_cell-1x03-pth.fzp', {width: 245, height: 85, keywords: ['weight']}),
    fritzing('tsop312', 'TSOP312 IR Receiver', 'Sensors', 'core/tsop312.fzp', {width: 75, height: 110, keywords: ['infrared']}),
    fritzing('amt103', 'AMT103 Encoder', 'Sensors', 'core/AMT103_1.fzp', {width: 150, height: 150, keywords: ['rotary encoder']}),

    wokwi('ir-receiver', 'IR Receiver', 'Communication', 'wokwi-ir-receiver', 75, 90, ['infrared']),
    wokwi('ir-remote', 'IR Remote', 'Communication', 'wokwi-ir-remote', 125, 220, ['infrared']),
    wokwi('microsd', 'MicroSD Card Module', 'Communication', 'wokwi-microsd-card', 155, 115, ['spi', 'storage']),
    custom('rdm6300-community', 'RDM6300 RFID Community Chip', 'Communication', 'djedu28/wokwi-rdm6300-custom-chip', {width: 175, height: 125, keywords: ['rfid', 'uart'], behavior: 'wasm-ready'}),
    custom('rc522-community', 'MFRC522 RFID Community Chip', 'Communication', 'anton21m/wokwi-rc522-rfid-chip', {width: 185, height: 145, keywords: ['rfid', 'spi'], behavior: 'wasm-ready'}),
    fritzing('hc05', 'HC-05 Bluetooth Module', 'Communication', 'core/HC-05-male_fix.fzp', {width: 180, height: 95, keywords: ['uart', 'bluetooth']}),
    fritzing('nrf24', 'nRF24L01 Module', 'Communication', 'core/NRF24L01_fix.fzp', {width: 155, height: 125, keywords: ['radio', 'spi']}),
    fritzing('nrf24-breakout', 'nRF24L01+ Breakout', 'Communication', 'core/NRF24L01+_breakout.fzp', {width: 175, height: 135, keywords: ['radio', 'spi']}),
    fritzing('rfm12b', 'RFM12B Transceiver', 'Communication', 'core/RFM12B_Transceiver_DIP_Package.fzp', {width: 150, height: 105, keywords: ['radio']}),
    fritzing('rfm23bp', 'RFM23BP Transceiver', 'Communication', 'core/RFM23BP.fzp', {width: 175, height: 130, keywords: ['radio']}),

    wokwi('ds1307', 'DS1307 RTC', 'Timing & Logic', 'wokwi-ds1307', 145, 105, ['rtc', 'clock']),
    fritzing('ds1302', 'DS1302 RTC', 'Timing & Logic', 'core/DS1302.fzp', {width: 145, height: 105, keywords: ['rtc']}),
    wokwi('clock-generator', 'Clock Generator', 'Timing & Logic', 'wokwi-clock-generator', 125, 125, ['pulse']),
    wokwi('74hc595', '74HC595 Shift Register', 'Timing & Logic', 'wokwi-74hc595', 145, 85, ['output expander']),
    wokwi('74hc165', '74HC165 Shift Register', 'Timing & Logic', 'wokwi-74hc165', 145, 85, ['input expander']),
    wokwi('nlsf595', 'NLSF595 RGB Driver', 'Timing & Logic', 'wokwi-nlsf595', 145, 85, ['shift register']),
    custom('frequency-counter', 'Frequency Counter Community Chip', 'Tools', 'drf5n/Wokwi-Chip-FrequencyCounter', {width: 190, height: 125, keywords: ['frequency', 'measurement'], behavior: 'wasm-ready'}),
    custom('schmitt-trigger', 'Schmitt Trigger Community Chip', 'Timing & Logic', 'drf5n/Wokwi-Chip-Schmitt-Trigger', {width: 165, height: 110, keywords: ['hysteresis', 'analog'], behavior: 'wasm-ready'}),
    custom('limit-counter', 'Limit Counter / Limit Switch Chip', 'Timing & Logic', 'drf5n/Wokwi-Chip-LimitCounter', {width: 185, height: 130, keywords: ['counter', 'limit switch', 'position'], behavior: 'wasm-ready'}),

    wokwi('resistor', 'Resistor', 'Basic Parts', 'wokwi-resistor', 115, 40, ['ohm']),
    wokwi('logic-analyzer', '8-Channel Logic Analyzer', 'Tools', 'wokwi-logic-analyzer', 175, 115, ['scope', 'digital']),
    wokwi('tv', 'PAL TV Screen', 'Tools', 'wokwi-tv', 230, 175, ['video'])
  ];

  const examples = {
    blink: {
      label: 'Blink — LED on pin 13',
      code: `const int ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  delay(500);\n  digitalWrite(ledPin, LOW);\n  delay(500);\n}`,
      parts: [
        {catalogId: 'arduino-uno', x: 100, y: 150},
        {catalogId: 'led', x: 500, y: 160, attrs: {color: 'red'}}
      ]
    },
    button: {
      label: 'Pushbutton controls LED',
      code: `const int buttonPin = 2;\nconst int ledPin = 9;\n\nvoid setup() {\n  pinMode(buttonPin, INPUT_PULLUP);\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, !digitalRead(buttonPin));\n}`,
      parts: [
        {catalogId: 'arduino-uno', x: 80, y: 140},
        {catalogId: 'pushbutton', x: 480, y: 120},
        {catalogId: 'led', x: 500, y: 260}
      ]
    },
    motor: {
      label: 'L298N + two TT motors',
      code: `const int ena = 5;\nconst int in1 = 7;\nconst int in2 = 8;\n\nvoid setup() {\n  pinMode(ena, OUTPUT);\n  pinMode(in1, OUTPUT);\n  pinMode(in2, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(in1, HIGH);\n  digitalWrite(in2, LOW);\n  analogWrite(ena, 190);\n  delay(2500);\n  digitalWrite(in1, LOW);\n  digitalWrite(in2, HIGH);\n  delay(2500);\n}`,
      parts: [
        {catalogId: 'arduino-uno', x: 50, y: 180},
        {catalogId: 'l298n-real', x: 400, y: 150},
        {catalogId: 'tt-motor-real', x: 730, y: 90},
        {catalogId: 'tt-motor-real', x: 730, y: 290}
      ]
    },
    breadboard: {
      label: 'Arduino with real breadboard',
      code: `const int ledPin = 6;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  for (int value = 0; value <= 255; value += 5) {\n    analogWrite(ledPin, value);\n    delay(25);\n  }\n}`,
      parts: [
        {catalogId: 'arduino-uno', x: 50, y: 190},
        {catalogId: 'half-breadboard-v2', x: 390, y: 100},
        {catalogId: 'led', x: 650, y: 200},
        {catalogId: 'resistor', x: 610, y: 290}
      ]
    }
  };

  window.EGAS_CATALOG = Object.freeze(components);
  window.EGAS_EXAMPLES = Object.freeze(examples);
})();
