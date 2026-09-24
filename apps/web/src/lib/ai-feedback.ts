export interface AiFeedback {
  title: string;
  description: string;
  tone: "info" | "error";
  action?: { label: string; href: string };
  retry?: boolean;
}

/** Friendly, bounded copy: never echo provider payloads or credentials into the UI. */
export function aiFeedback(message: string): AiFeedback {
  if (/^No (?:closed )?trades match/.test(message))
    return {
      title: "Нет подходящих сделок",
      description:
        "В этой выборке нет сделок для анализа. Измените счета, даты или другие фильтры журнала.",
      tone: "info",
    };
  if (
    /^A selected account no longer exists|^Invalid .* filter|^Invalid .* (?:date|time|number|range)|^Unknown journal filter|^filters is required|^From date must/.test(
      message,
    )
  )
    return {
      title: "Проверьте фильтры журнала",
      description:
        "Выбранная область больше недействительна. Обновите счета и фильтры перед повторной попыткой.",
      tone: "info",
    };
  if (/^Journal timezone changed/.test(message))
    return {
      title: "Обновите журнал",
      description:
        "Часовой пояс журнала изменился. Обновите эту страницу, чтобы отображаемые даты и анализ AI совпадали.",
      tone: "info",
    };
  if (/AI is not configured/i.test(message))
    return {
      title: "Настройте AI для продолжения",
      description:
        "Подключите ключ API Anthropic или OpenAI в настройках, чтобы задавать вопросы, генерировать обзоры и анализировать сделки.",
      tone: "info",
      action: { label: "Настроить AI", href: "/settings#ai-settings" },
    };
  if (
    /invalid.*(?:api.?key|x-api-key)|incorrect api key|authentication_error|invalid_api_key/i.test(
      message,
    )
  )
    return {
      title: "Проверьте подключение AI",
      description:
        "Ваш AI-провайдер не смог проверить ваш ключ или разрешения. Проверьте их в настройках, затем попробуйте снова.",
      tone: "error",
      action: { label: "Проверить настройки AI", href: "/settings#ai-settings" },
    };
  if (
    /credit balance|billing|insufficient.*(?:credit|quota)|exceeded your current quota/i.test(
      message,
    )
  )
    return {
      title: "Ваш аккаунт AI требует внимания",
      description:
        "Проверьте биллинг, кредитный баланс или квоту в аккаунте AI-провайдера, затем попробуйте снова.",
      tone: "info",
    };
  if (/model unavailable|model_not_found/i.test(message))
    return {
      title: "Проверьте вашу AI-модель",
      description: "Проверьте ID модели и доступ аккаунта провайдера в настройках.",
      tone: "error",
      action: { label: "Проверить настройки AI", href: "/settings#ai-settings" },
    };
  if (/rate.limit|too many requests|overloaded/i.test(message))
    return {
      title: "AI временно занят",
      description: "Пожалуйста, подождите немного перед повторной попыткой. Данные вашего журнала не изменились.",
      tone: "info",
      retry: true,
    };
  if (/journal is empty/i.test(message))
    return {
      title: "Добавьте сделки для начала",
      description:
        "AI-инсайты используют историю вашего журнала. Импортируйте сделки, затем задайте вопрос снова.",
      tone: "info",
      action: { label: "Импортировать сделки", href: "/import" },
    };
  if (/No closed trades on this day/i.test(message))
    return {
      title: "Пока нет сделок для обзора",
      description:
        "Для обзора нужна хотя бы одна закрытая сделка в этот день. Вы всё ещё можете написать свою дневную заметку.",
      tone: "info",
    };
  if (/Unauthorized/i.test(message))
    return {
      title: "Пожалуйста, войдите снова",
      description: "Возможно, ваша сессия истекла. Войдите, чтобы продолжить использование журнала.",
      tone: "info",
      action: { label: "Войти", href: "/login" },
    };
  if (/failed to fetch|network|timeout|timed out|connection/i.test(message))
    return {
      title: "Не удалось подключиться к AI",
      description: "Проверьте подключение и попробуйте снова. Данные вашего журнала не изменились.",
      tone: "error",
      retry: true,
    };
  return {
    title: "Не удалось выполнить запрос AI",
    description: "Пожалуйста, попробуйте снова через некоторое время. Если это продолжится, проверьте настройки AI.",
    tone: "error",
    retry: true,
  };
}