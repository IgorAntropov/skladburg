const DEMO_ADDRESSES: Readonly<Partial<Record<string, readonly string[]>>> = Object.freeze({
  'Воронеж': ['проезд Медовых Катушек, 3', 'ул. Янтарных Вагонеток, 8'],
  'Екатеринбург': ['проезд Чугунных Компасов, 2', 'ул. Каменных Тележек, 16'],
  'Казань': ['ул. Рябиновых Фонарей, 8', 'ул. Рябиновых Фонарей, 14', 'проезд Клёновых Контейнеров, 3'],
  'Краснодар': ['проезд Лимонных Весов, 4', 'ул. Абрикосовых Шлюзов, 8'],
  'Москва': ['ул. Рябиновых Маяков, 6', 'проезд Медных Стеллажей, 12'],
  'Нижний Новгород': ['проезд Речных Пандусов, 8', 'ул. Льняных Барж, 12'],
  'Новосибирск': ['проезд Кедровых Кранов, 4', 'ул. Снежных Биркодержателей, 10'],
  'Санкт-Петербург': ['проезд Балтийских Роликов, 2', 'ул. Гранитных Пломб, 6'],
  'Челябинск': ['проезд Стальных Катушек, 8', 'ул. Дымчатых Погрузчиков, 13'],
});

const toWords = (value: string): string[] => value.toLowerCase().replaceAll('ё', 'е').match(/[\p{L}\p{N}]+/gu) ?? [];

export const findDemoWarehouseAddresses = (cityName: string | undefined, query: string): readonly string[] => {
  const terms = toWords(query);

  if (cityName === undefined || !Object.hasOwn(DEMO_ADDRESSES, cityName) || terms.join('').length < 2) {
    return [];
  }

  return (DEMO_ADDRESSES[cityName] ?? []).filter((address) => {
    const words = toWords(address);

    return terms.every(term => words.some(word => word.startsWith(term)));
  });
};
