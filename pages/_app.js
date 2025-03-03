import '../styles/globals.scss'
import { ApolloProvider, gql } from '@apollo/client'
import { MeProvider } from '../components/me'
import PlausibleProvider from 'next-plausible'
import getApolloClient from '../lib/apollo.js'
import { PriceProvider } from '../components/price'
import { BlockHeightProvider } from '../components/block-height'
import Head from 'next/head'
import { useRouter } from 'next/dist/client/router'
import { useEffect } from 'react'
import { ShowModalProvider } from '../components/modal'
import ErrorBoundary from '../components/error-boundary'
import { LightningProvider } from '../components/lightning'
import { ToastProvider } from '../components/toast'
import { ServiceWorkerProvider } from '../components/serviceworker'
import { SSR } from '../lib/constants'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { LoggerProvider } from '../components/logger'
import { ChainFeeProvider } from '../components/chain-fee.js'
import { WebLNProvider } from '../components/webln'
import dynamic from 'next/dynamic'

const PWAPrompt = dynamic(() => import('react-ios-pwa-prompt'), { ssr: false })

NProgress.configure({
  showSpinner: false
})

function writeQuery (client, apollo, data) {
  if (apollo && data) {
    client.writeQuery({
      query: gql`${apollo.query}`,
      data,
      variables: apollo.variables,
      overwrite: SSR,
      broadcast: false
    })
  }
}

export default function MyApp ({ Component, pageProps: { ...props } }) {
  const client = getApolloClient()
  const router = useRouter()

  useEffect(() => {
    const nprogressStart = (_, { shallow }) => !shallow && NProgress.start()
    const nprogressDone = (_, { shallow }) => !shallow && NProgress.done()

    router.events.on('routeChangeStart', nprogressStart)
    router.events.on('routeChangeComplete', nprogressDone)
    router.events.on('routeChangeError', nprogressDone)

    if (!props?.apollo) return
    // HACK: 'cause there's no way to tell Next to skip SSR
    // So every page load, we modify the route in browser history
    // to point to the same page but without SSR, ie ?nodata=true
    // this nodata var will get passed to the server on back/foward and
    // 1. prevent data from reloading and 2. perserve scroll
    // (2) is not possible while intercepting nav with beforePopState
    router.replace({
      pathname: router.pathname,
      query: { ...router.query, nodata: true }
    }, router.asPath, { ...router.options, shallow: true }).catch((e) => {
      // workaround for https://github.com/vercel/next.js/issues/37362
      if (!e.cancelled) {
        console.log(e)
        throw e
      }
    })

    return () => {
      router.events.off('routeChangeStart', nprogressStart)
      router.events.off('routeChangeComplete', nprogressDone)
      router.events.off('routeChangeError', nprogressDone)
    }
  }, [router.asPath, props?.apollo])

  /*
    If we are on the client, we populate the apollo cache with the
    ssr data
  */
  const { apollo, ssrData, me, price, blockHeight, chainFee, ...otherProps } = props
  useEffect(() => {
    writeQuery(client, apollo, ssrData)
  }, [client, apollo, ssrData])

  return (
    <>
      <Head>
        <meta name='viewport' content='initial-scale=1.0, width=device-width' />
      </Head>
      <ErrorBoundary>
        <PlausibleProvider domain='stacker.news' trackOutboundLinks>
          <ApolloProvider client={client}>
            <MeProvider me={me}>
              <LoggerProvider>
                <ServiceWorkerProvider>
                  <PriceProvider price={price}>
                    <LightningProvider>
                      <ToastProvider>
                        <WebLNProvider>
                          <ShowModalProvider>
                            <BlockHeightProvider blockHeight={blockHeight}>
                              <ChainFeeProvider chainFee={chainFee}>
                                <ErrorBoundary>
                                  <Component ssrData={ssrData} {...otherProps} />
                                  <PWAPrompt copyBody='This website has app functionality. Add it to your home screen to use it in fullscreen and receive notifications. In Safari:' promptOnVisit={2} />
                                </ErrorBoundary>
                              </ChainFeeProvider>
                            </BlockHeightProvider>
                          </ShowModalProvider>
                        </WebLNProvider>
                      </ToastProvider>
                    </LightningProvider>
                  </PriceProvider>
                </ServiceWorkerProvider>
              </LoggerProvider>
            </MeProvider>
          </ApolloProvider>
        </PlausibleProvider>
      </ErrorBoundary>
    </>
  )
}
