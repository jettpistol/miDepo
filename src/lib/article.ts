/**
 * How an article's name is shown: always in capitals, on every screen, message and printout.
 * The stored name keeps its original case (it comes from Fierro and goes back to it in the CSV files).
 */
export const articleName = (title: string) => title.toLocaleUpperCase("es-AR");
