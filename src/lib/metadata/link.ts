/** Abre o endereço anunciado em MetadataURL na página de leitura do registro. */
export function urlDoMetadado(link: string): string {
  return `/metadado?link=${encodeURIComponent(link)}`;
}
