import { Helmet } from "react-helmet-async";

const BASE_TITLE = "JitzManager";

interface SeoProps {
  title: string;
  description?: string;
  path?: string;
}

export function Seo({ title, description, path }: SeoProps) {
  const fullTitle = title === BASE_TITLE ? title : `${title} — ${BASE_TITLE}`;
  const canonicalUrl = path ? `https://jitzmanager.com${path}` : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {description && (
        <meta property="og:title" content={fullTitle} />
      )}
      {description && (
        <meta property="og:description" content={description} />
      )}
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
    </Helmet>
  );
}
