import { useI18n } from '../../i18n'
import { ButtonLink } from '../../components/ui'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

export default function NotFound({ message }: { message?: string }) {
  const { t } = useI18n()
  useDocumentTitle(t('common.notFound.title'))
  return (
    <section className="container-site flex min-h-[60vh] flex-col items-start justify-center gap-6 py-24">
      <p className="font-display text-7xl font-light text-brass-500">404</p>
      <h1 className="text-display-md text-forest-950">{t('common.notFound.title')}</h1>
      <p className="max-w-lg text-stone-600">{message ?? t('common.notFound.body')}</p>
      <div className="flex gap-3">
        <ButtonLink to="/">{t('common.home')}</ButtonLink>
        <ButtonLink to="/catalog" variant="secondary">
          {t('nav.catalog')}
        </ButtonLink>
      </div>
    </section>
  )
}
