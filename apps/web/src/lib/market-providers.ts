import type { Resolution } from "./market-data";

export interface CredentialField {
  key: string;
  label: string;
  environmentKey: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}
export interface ProviderInfo {
  id: string;
  name: string;
  mode: "credentials" | "public" | "csv";
  description: string;
  symbolHint: string;
  fields: CredentialField[];
  datasets?: { value: string; label: string }[];
  resolutions?: Resolution[];
}
export const MARKET_PROVIDERS: ProviderInfo[] = [
  {
    id: "london-strategic-edge",
    name: "London Strategic Edge",
    mode: "credentials",
    description:
      "Исторические свечи. Цены акций и ETF скорректированы на сплиты; покрытие зависит от вашего плана.",
    symbolHint: "Используйте точный символ провайдера, включая фьючерсный контракт или валютную пару.",
    fields: [{ key: "apiKey", label: "API key", environmentKey: "LSE_API_KEY" }],
  },
  {
    id: "alpaca",
    name: "Alpaca",
    mode: "credentials",
    description:
      "Акции США и крипто. Выберите ленту акций или крипто; SIP требует соответствующего доступа к данным. Цены акций не скорректированы.",
    symbolHint: "Акции: AAPL. Крипто: BTC/USD; выберите набор данных Crypto.",
    fields: [
      { key: "apiKey", label: "ID ключа", environmentKey: "ALPACA_API_KEY" },
      { key: "secretKey", label: "Секретный ключ", environmentKey: "ALPACA_SECRET_KEY" },
    ],
    datasets: [
      { value: "", label: "Выберите ленту данных" },
      { value: "iex", label: "Акции IEX" },
      { value: "sip", label: "Акции SIP" },
      { value: "crypto", label: "Крипто (США)" },
    ],
  },
  {
    id: "binance",
    name: "Binance",
    mode: "public",
    description:
      "Публичные спот-свечи Binance. Ключ API не требуется. Доступность зависит от вашего региона и указанной пары.",
    symbolHint:
      "Спот-пары используют BTCUSDT или ETHUSDT. USDT — это не USD; валюта счёта и котировки должны совпадать для оценок.",
    fields: [],
  },
  {
    id: "coinbase",
    name: "Coinbase",
    mode: "public",
    description:
      "Публичные спот-свечи Coinbase Exchange. Ключ API не требуется; интервалы без сделок могут не иметь свечи.",
    symbolHint: "Используйте продукт Coinbase Exchange, такой как BTC-USD или ETH-USD.",
    fields: [],
  },
  {
    id: "oanda",
    name: "OANDA",
    mode: "credentials",
    description:
      "Свечи Forex и CFD из вашего счёта v20. Цены по середине, свечи выровнены по UTC и объём по тикам; спред и конвертация валюты не включены.",
    symbolHint:
      "Используйте инструмент OANDA, такой как EUR_USD. Укажите множитель контракта в настройках, чтобы он соответствовал единицам в ваших филлах.",
    fields: [
      { key: "apiKey", label: "Токен доступа", environmentKey: "OANDA_API_TOKEN" },
      { key: "accountId", label: "ID счёта v20", environmentKey: "OANDA_ACCOUNT_ID" },
      {
        key: "environment",
        label: "Окружение",
        environmentKey: "OANDA_ENVIRONMENT",
        defaultValue: "practice",
        options: [
          { value: "practice", label: "Демо" },
          { value: "live", label: "Реальный" },
        ],
      },
    ],
  },
  {
    id: "market-csv",
    name: "Market data CSV",
    mode: "csv",
    description:
      "Локальные файлы свечей OHLCV. Загружайте рыночные цены отдельно от исполнений сделок.",
    symbolHint:
      "Используйте точный символ и разрешение, записанные для загруженного файла. Выберите набор данных, когда файлы перекрываются.",
    fields: [],
  },
];
export const providerInfo = (id: string) => MARKET_PROVIDERS.find((item) => item.id === id);