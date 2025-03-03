import { Checkbox, Form, Input, SubmitButton, Select, VariableInput, CopyInput } from '../../components/form'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import { CenterLayout } from '../../components/layout'
import { useState, useMemo } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { getGetServerSideProps } from '../../api/ssrApollo'
import LoginButton from '../../components/login-button'
import { signIn } from 'next-auth/react'
import { LightningAuth } from '../../components/lightning-auth'
import { SETTINGS, SET_SETTINGS } from '../../fragments/users'
import { useRouter } from 'next/router'
import Info from '../../components/info'
import Link from 'next/link'
import AccordianItem from '../../components/accordian-item'
import { bech32 } from 'bech32'
import { NOSTR_MAX_RELAY_NUM, NOSTR_PUBKEY_BECH32, DEFAULT_CROSSPOSTING_RELAYS } from '../../lib/nostr'
import { emailSchema, lastAuthRemovalSchema, settingsSchema } from '../../lib/validate'
import { SUPPORTED_CURRENCIES } from '../../lib/currency'
import PageLoading from '../../components/page-loading'
import { useShowModal } from '../../components/modal'
import { authErrorMessage } from '../../components/login'
import { NostrAuth } from '../../components/nostr-auth'
import { useToast } from '../../components/toast'
import { useLogger } from '../../components/logger'
import { useMe } from '../../components/me'
import { INVOICE_RETENTION_DAYS } from '../../lib/constants'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import DeleteIcon from '../../svgs/delete-bin-line.svg'

export const getServerSideProps = getGetServerSideProps({ query: SETTINGS, authRequired: true })

function bech32encode (hexString) {
  return bech32.encode('npub', bech32.toWords(Buffer.from(hexString, 'hex')))
}

export default function Settings ({ ssrData }) {
  const toaster = useToast()
  const me = useMe()
  const [setSettings] = useMutation(SET_SETTINGS, {
    update (cache, { data: { setSettings } }) {
      cache.modify({
        id: 'ROOT_QUERY',
        fields: {
          settings () {
            return setSettings
          }
        }
      })
    }
  }
  )
  const logger = useLogger()

  const { data } = useQuery(SETTINGS)
  const { settings: { privates: settings } } = useMemo(() => data ?? ssrData, [data, ssrData])
  if (!data && !ssrData) return <PageLoading />

  return (
    <CenterLayout>
      <div className='py-3 w-100'>
        <h2 className='mb-2 text-start'>settings</h2>
        <Form
          initial={{
            tipDefault: settings?.tipDefault || 21,
            turboTipping: settings?.turboTipping,
            zapUndos: settings?.zapUndos,
            fiatCurrency: settings?.fiatCurrency || 'USD',
            withdrawMaxFeeDefault: settings?.withdrawMaxFeeDefault,
            noteItemSats: settings?.noteItemSats,
            noteEarning: settings?.noteEarning,
            noteAllDescendants: settings?.noteAllDescendants,
            noteMentions: settings?.noteMentions,
            noteDeposits: settings?.noteDeposits,
            noteInvites: settings?.noteInvites,
            noteJobIndicator: settings?.noteJobIndicator,
            noteCowboyHat: settings?.noteCowboyHat,
            noteForwardedSats: settings?.noteForwardedSats,
            hideInvoiceDesc: settings?.hideInvoiceDesc,
            autoDropBolt11s: settings?.autoDropBolt11s,
            hideFromTopUsers: settings?.hideFromTopUsers,
            hideCowboyHat: settings?.hideCowboyHat,
            hideGithub: settings?.hideGithub,
            hideNostr: settings?.hideNostr,
            hideTwitter: settings?.hideTwitter,
            imgproxyOnly: settings?.imgproxyOnly,
            wildWestMode: settings?.wildWestMode,
            greeterMode: settings?.greeterMode,
            nsfwMode: settings?.nsfwMode,
            nostrPubkey: settings?.nostrPubkey ? bech32encode(settings.nostrPubkey) : '',
            nostrCrossposting: settings?.nostrCrossposting,
            nostrRelays: settings?.nostrRelays?.length ? settings?.nostrRelays : [''],
            hideBookmarks: settings?.hideBookmarks,
            hideWalletBalance: settings?.hideWalletBalance,
            diagnostics: settings?.diagnostics,
            hideIsContributor: settings?.hideIsContributor
          }}
          schema={settingsSchema}
          onSubmit={async ({ tipDefault, withdrawMaxFeeDefault, nostrPubkey, nostrRelays, ...values }) => {
            if (nostrPubkey.length === 0) {
              nostrPubkey = null
            } else {
              if (NOSTR_PUBKEY_BECH32.test(nostrPubkey)) {
                const { words } = bech32.decode(nostrPubkey)
                nostrPubkey = Buffer.from(bech32.fromWords(words)).toString('hex')
              }
            }

            const nostrRelaysFiltered = nostrRelays?.filter(word => word.trim().length > 0)

            try {
              await setSettings({
                variables: {
                  settings: {
                    tipDefault: Number(tipDefault),
                    withdrawMaxFeeDefault: Number(withdrawMaxFeeDefault),
                    nostrPubkey,
                    nostrRelays: nostrRelaysFiltered,
                    ...values
                  }
                }
              })
              toaster.success('saved settings')
            } catch (err) {
              console.error(err)
              toaster.danger('failed to save settings')
            }
          }}
        >
          <Input
            label='zap default'
            name='tipDefault'
            groupClassName='mb-0'
            required
            autoFocus
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
            hint={<small className='text-muted'>note: you can also press and hold the lightning bolt to zap custom amounts</small>}
          />
          <div className='mb-2'>
            <AccordianItem
              show={settings?.turboTipping}
              header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>advanced</div>}
              body={
                <>
                  <Checkbox
                    name='turboTipping'
                    label={
                      <div className='d-flex align-items-center'>turbo zapping
                        <Info>
                          <ul className='fw-bold'>
                            <li>Makes every additional bolt click raise your total zap to another 10x multiple of your default zap</li>
                            <li>e.g. if your zap default is 10 sats
                              <ul>
                                <li>1st click: 10 sats total zapped</li>
                                <li>2nd click: 100 sats total zapped</li>
                                <li>3rd click: 1000 sats total zapped</li>
                                <li>4th click: 10000 sats total zapped</li>
                                <li>and so on ...</li>
                              </ul>
                            </li>
                            <li>You can still custom zap via long press
                              <ul>
                                <li>the next bolt click rounds up to the next greatest 10x multiple of your default</li>
                              </ul>
                            </li>
                          </ul>
                        </Info>
                      </div>
                    }
                    groupClassName='mb-0'
                  />
                  <Checkbox
                    name='zapUndos'
                    label={
                      <div className='d-flex align-items-center'>zap undos
                        <Info>
                          <ul className='fw-bold'>
                            <li>An undo button is shown after every zap</li>
                            <li>The button is shown for 5 seconds</li>
                            <li>
                              The button is only shown for zaps from the custodial wallet
                            </li>
                            <li>
                              Use a budget or manual approval with attached wallets
                            </li>
                          </ul>
                        </Info>
                      </div>
                    }
                  />
                </>
              }
            />
          </div>
          <Select
            label='fiat currency'
            name='fiatCurrency'
            size='sm'
            items={SUPPORTED_CURRENCIES}
            required
          />
          <Input
            label='default max fee for withdrawals'
            name='withdrawMaxFeeDefault'
            required
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <div className='form-label'>notify me when ...</div>
          <Checkbox
            label='I stack sats from posts and comments'
            name='noteItemSats'
            groupClassName='mb-0'
          />
          <Checkbox
            label='I get forwarded sats from a post'
            name='noteForwardedSats'
            groupClassName='mb-0'
          />
          <Checkbox
            label='I get a daily airdrop'
            name='noteEarning'
            groupClassName='mb-0'
          />
          <Checkbox
            label='someone replies to someone who replied to me'
            name='noteAllDescendants'
            groupClassName='mb-0'
          />
          <Checkbox
            label='someone joins using my invite or referral links'
            name='noteInvites'
            groupClassName='mb-0'
          />
          <Checkbox
            label='sats are deposited in my account'
            name='noteDeposits'
            groupClassName='mb-0'
          />
          <Checkbox
            label='someone mentions me'
            name='noteMentions'
            groupClassName='mb-0'
          />
          <Checkbox
            label='there is a new job'
            name='noteJobIndicator'
            groupClassName='mb-0'
          />
          <Checkbox
            label='I find or lose a cowboy hat'
            name='noteCowboyHat'
          />
          <div className='form-label'>privacy</div>
          <Checkbox
            label={
              <div className='d-flex align-items-center'>hide invoice descriptions
                <Info>
                  <ul className='fw-bold'>
                    <li>Use this if you don't want funding sources to be linkable to your SN identity.</li>
                    <li>It makes your invoice descriptions blank.</li>
                    <li>This only applies to invoices you create
                      <ul>
                        <li>lnurl-pay and lightning addresses still reference your nym</li>
                      </ul>
                    </li>
                  </ul>
                </Info>
              </div>
            }
            name='hideInvoiceDesc'
            groupClassName='mb-0'
          />
          <DropBolt11sCheckbox
            ssrData={ssrData}
            label={
              <div className='d-flex align-items-center'>autodelete withdrawal invoices
                <Info>
                  <ul className='fw-bold'>
                    <li>use this to protect receiver privacy</li>
                    <li>applies retroactively, cannot be reversed</li>
                    <li>withdrawal invoices are kept at least {INVOICE_RETENTION_DAYS} days for security and debugging purposes</li>
                    <li>autodeletions are run a daily basis at night</li>
                  </ul>
                </Info>
              </div>
            }
            name='autoDropBolt11s'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>hide me from  <Link href='/top/stackers/day'>top stackers</Link></>}
            name='hideFromTopUsers'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>hide my cowboy hat</>}
            name='hideCowboyHat'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>hide my wallet balance</>}
            name='hideWalletBalance'
            groupClassName='mb-0'
          />
          <Checkbox
            label={<>hide my bookmarks from other stackers</>}
            name='hideBookmarks'
            groupClassName='mb-0'
          />
          <Checkbox
            disabled={me.optional.githubId === null}
            label={
              <div className='d-flex align-items-center'>hide my linked github profile
                <Info>
                  <ul className='fw-bold'>
                    <li>Linked accounts are hidden from your profile by default</li>
                    <li>uncheck this to display your github on your profile</li>
                    {me.optional.githubId === null &&
                      <div className='my-2'>
                        <li><i>You don't seem to have a linked github account</i></li>
                        <ul><li>If this is wrong, try unlinking/relinking</li></ul>
                      </div>}
                  </ul>
                </Info>
              </div>
            }
            name='hideGithub'
            groupClassName='mb-0'
          />
          <Checkbox
            disabled={me.optional.nostrAuthPubkey === null}
            label={
              <div className='d-flex align-items-center'>hide my linked nostr profile
                <Info>
                  <ul className='fw-bold'>
                    <li>Linked accounts are hidden from your profile by default</li>
                    <li>Uncheck this to display your npub on your profile</li>
                    {me.optional.nostrAuthPubkey === null &&
                      <div className='my-2'>
                        <li>You don't seem to have a linked nostr account</li>
                        <ul><li>If this is wrong, try unlinking/relinking</li></ul>
                      </div>}
                  </ul>
                </Info>
              </div>
            }
            name='hideNostr'
            groupClassName='mb-0'
          />
          <Checkbox
            disabled={me.optional.twitterId === null}
            label={
              <div className='d-flex align-items-center'>hide my linked twitter profile
                <Info>
                  <ul className='fw-bold'>
                    <li>Linked accounts are hidden from your profile by default</li>
                    <li>Uncheck this to display your twitter on your profile</li>
                    {me.optional.twitterId === null &&
                      <div className='my-2'>
                        <i>You don't seem to have a linked twitter account</i>
                        <ul><li>If this is wrong, try unlinking/relinking</li></ul>
                      </div>}
                  </ul>
                </Info>
              </div>
            }
            name='hideTwitter'
            groupClassName='mb-0'
          />
          {me.optional?.isContributor &&
            <Checkbox
              label={<>hide that I'm a stacker.news contributor</>}
              name='hideIsContributor'
              groupClassName='mb-0'
            />}
          <Checkbox
            label={
              <div className='d-flex align-items-center'>only load images from proxy
                <Info>
                  <ul className='fw-bold'>
                    <li>only load images from our image proxy automatically</li>
                    <li>this prevents IP address leaks to arbitrary sites</li>
                    <li>if we fail to load an image, the raw link will be shown</li>
                  </ul>
                </Info>
              </div>
            }
            name='imgproxyOnly'
            groupClassName='mb-0'
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>allow anonymous diagnostics
                <Info>
                  <ul className='fw-bold'>
                    <li>collect and send back anonymous diagnostics data</li>
                    <li>this information is used to fix bugs</li>
                    <li>this information includes:
                      <ul><li>timestamps</li></ul>
                      <ul><li>a randomly generated fancy name</li></ul>
                      <ul><li>your user agent</li></ul>
                      <ul><li>your operating system</li></ul>
                    </li>
                    <li>this information can not be traced back to you without your fancy name</li>
                    <li>fancy names are generated in your browser</li>
                  </ul>
                  <div className='text-muted fst-italic'>your fancy name: {logger.name}</div>
                </Info>
              </div>
            }
            name='diagnostics'
          />
          <div className='form-label'>content</div>
          <Checkbox
            label={
              <div className='d-flex align-items-center'>wild west mode
                <Info>
                  <ul className='fw-bold'>
                    <li>don't hide flagged content</li>
                    <li>don't down rank flagged content</li>
                  </ul>
                </Info>
              </div>
            }
            name='wildWestMode'
            groupClassName='mb-0'
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>greeter mode
                <Info>
                  <ul className='fw-bold'>
                    <li>see and screen free posts and comments</li>
                    <li>help onboard new stackers to SN and Lightning</li>
                    <li>you might be subject to more spam</li>
                  </ul>
                </Info>
              </div>
            }
            name='greeterMode'
            groupClassName='mb-0'
          />
          <Checkbox
            label={
              <div className='d-flex align-items-center'>nsfw mode
                <Info>
                  <ul className='fw-bold'>
                    <li>see posts from nsfw territories</li>
                  </ul>
                </Info>
              </div>
            }
            name='nsfwMode'
          />
          <h4>nostr</h4>
          <Checkbox
            label={
              <div className='d-flex align-items-center'>crosspost to nostr
                <Info>
                  <ul className='fw-bold'>
                    <li>crosspost your items to nostr</li>
                    <li>requires NIP-07 extension for signing</li>
                    <li>we use your NIP-05 relays if set</li>
                    <li>we use these relays by default:</li>
                    <ul>
                      {DEFAULT_CROSSPOSTING_RELAYS.map((relay, i) => (
                        <li key={i}>{relay}</li>
                      ))}
                    </ul>
                  </ul>
                </Info>
              </div>
            }
            name='nostrCrossposting'
          />
          <Input
            label={<>pubkey <small className='text-muted ms-2'>optional</small></>}
            name='nostrPubkey'
            clear
            hint={<small className='text-muted'>used for NIP-05</small>}
          />
          <VariableInput
            label={<>relays <small className='text-muted ms-2'>optional</small></>}
            name='nostrRelays'
            clear
            min={0}
            max={NOSTR_MAX_RELAY_NUM}
            hint={<small className='text-muted'>used for NIP-05 and crossposting</small>}
          />
          <div className='d-flex'>
            <SubmitButton variant='info' className='ms-auto mt-1 px-4'>save</SubmitButton>
          </div>
        </Form>
        <div className='text-start w-100'>
          <div className='form-label'>saturday newsletter</div>
          <Button href='https://mail.stacker.news/subscription/form' target='_blank'>(re)subscribe</Button>
          {settings?.authMethods && <AuthMethods methods={settings.authMethods} apiKeyEnabled={settings.apiKeyEnabled} />}
        </div>
      </div>
    </CenterLayout>
  )
}

const DropBolt11sCheckbox = ({ ssrData, ...props }) => {
  const showModal = useShowModal()
  const { data } = useQuery(gql`{ numBolt11s }`)
  const { numBolt11s } = data || ssrData

  return (
    <Checkbox
      onClick={e => {
        if (e.target.checked) {
          showModal(onClose => {
            return (
              <>
                <p className='fw-bolder'>{numBolt11s} withdrawal invoices will be deleted with this setting.</p>
                <p className='fw-bolder'>You sure? This is a gone forever kind of delete.</p>
                <div className='d-flex justify-content-end'>
                  <Button
                    variant='danger' onClick={async () => {
                      await onClose()
                    }}
                  >I am sure
                  </Button>
                </div>
              </>
            )
          })
        }
      }}
      {...props}
    />
  )
}

function QRLinkButton ({ provider, unlink, status }) {
  const showModal = useShowModal()
  const text = status ? 'Unlink' : 'Link'
  const onClick = status
    ? unlink
    : () => showModal(onClose =>
      <div className='d-flex flex-column align-items-center'>
        <LightningAuth />
      </div>)

  return (
    <LoginButton
      key={provider}
      className='d-block mt-2' type={provider} text={text} onClick={onClick}
    />
  )
}

function NostrLinkButton ({ unlink, status }) {
  const showModal = useShowModal()
  const text = status ? 'Unlink' : 'Link'
  const onClick = status
    ? unlink
    : () => showModal(onClose =>
      <div className='d-flex flex-column align-items-center'>
        <NostrAuth text='Unlink' />
      </div>)

  return (
    <LoginButton
      className='d-block mt-2' type='nostr' text={text} onClick={onClick}
    />
  )
}

function UnlinkObstacle ({ onClose, type, unlinkAuth }) {
  const router = useRouter()
  const toaster = useToast()

  return (
    <div>
      You are removing your last auth method. It is recommended you link another auth method before removing
      your last auth method. If you'd like to proceed anyway, type the following below
      <div className='text-danger fw-bold my-2'>
        If I logout, even accidentally, I will never be able to access my account again
      </div>
      <Form
        className='mt-3'
        initial={{
          warning: ''
        }}
        schema={lastAuthRemovalSchema}
        onSubmit={async () => {
          try {
            await unlinkAuth({ variables: { authType: type } })
            router.push('/settings')
            onClose()
            toaster.success('unlinked auth method')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to unlink auth method')
          }
        }}
      >
        <Input
          name='warning'
          required
        />
        <SubmitButton className='d-flex ms-auto' variant='danger'>do it</SubmitButton>
      </Form>
    </div>
  )
}

function AuthMethods ({ methods, apiKeyEnabled }) {
  const showModal = useShowModal()
  const router = useRouter()
  const toaster = useToast()
  const [err, setErr] = useState(authErrorMessage(router.query.error))
  const [unlinkAuth] = useMutation(
    gql`
      mutation unlinkAuth($authType: String!) {
        unlinkAuth(authType: $authType) {
          lightning
          email
          twitter
          github
          nostr
        }
      }`, {
      update (cache, { data: { unlinkAuth } }) {
        cache.modify({
          id: 'ROOT_QUERY',
          fields: {
            settings (existing) {
              return {
                ...existing,
                privates: {
                  ...existing.privates,
                  authMethods: { ...unlinkAuth }
                }
              }
            }
          }
        })
      }
    }
  )

  // sort to prevent hydration mismatch
  const providers = Object.keys(methods).filter(k => k !== '__typename' && k !== 'apiKey').sort()

  const unlink = async type => {
    // if there's only one auth method left
    const links = providers.reduce((t, p) => t + (methods[p] ? 1 : 0), 0)
    if (links === 1) {
      showModal(onClose => (<UnlinkObstacle onClose={onClose} type={type} unlinkAuth={unlinkAuth} />))
    } else {
      try {
        await unlinkAuth({ variables: { authType: type } })
        toaster.success('unlinked auth method')
      } catch (err) {
        console.error(err)
        toaster.danger('failed to unlink auth method')
      }
    }
  }

  return (
    <>
      <div className='form-label mt-3'>auth methods</div>
      {err && (
        <Alert
          variant='danger' onClose={() => {
            const { pathname, query: { error, nodata, ...rest } } = router
            router.replace({
              pathname,
              query: { nodata, ...rest }
            }, { pathname, query: { ...rest } }, { shallow: true })
            setErr(undefined)
          }} dismissible
        >{err}
        </Alert>
      )}

      {providers?.map(provider => {
        if (provider === 'email') {
          return methods.email
            ? (
              <div key={provider} className='mt-2 d-flex align-items-center'>
                <Input
                  name='email'
                  placeholder={methods.email}
                  groupClassName='mb-0'
                  readOnly
                  noForm
                />
                <Button
                  className='ms-2' variant='secondary' onClick={
                    async () => {
                      await unlink('email')
                    }
                  }
                >Unlink Email
                </Button>
              </div>
              )
            : <div key={provider} className='mt-2'><EmailLinkForm /></div>
        } else if (provider === 'lightning') {
          return (
            <QRLinkButton
              key={provider} provider={provider}
              status={methods[provider]} unlink={async () => await unlink(provider)}
            />
          )
        } else if (provider === 'nostr') {
          return <NostrLinkButton key='nostr' status={methods[provider]} unlink={async () => await unlink(provider)} />
        } else {
          return (
            <LoginButton
              className='mt-2 d-block'
              key={provider}
              type={provider.toLowerCase()}
              onClick={async () => {
                if (methods[provider]) {
                  await unlink(provider)
                } else {
                  signIn(provider)
                }
              }}
              text={methods[provider] ? 'Unlink' : 'Link'}
            />
          )
        }
      })}
      <ApiKey apiKey={methods.apiKey} enabled={apiKeyEnabled} />
    </>
  )
}

export function EmailLinkForm ({ callbackUrl }) {
  const [linkUnverifiedEmail] = useMutation(
    gql`
      mutation linkUnverifiedEmail($email: String!) {
        linkUnverifiedEmail(email: $email)
      }`
  )

  return (
    <Form
      initial={{
        email: ''
      }}
      schema={emailSchema}
      onSubmit={async ({ email }) => {
        // add email to user's account
        // then call signIn
        const { data } = await linkUnverifiedEmail({ variables: { email } })
        if (data.linkUnverifiedEmail) {
          signIn('email', { email, callbackUrl })
        }
      }}
    >
      <div className='d-flex align-items-center'>
        <Input
          name='email'
          placeholder='email@example.com'
          required
          groupClassName='mb-0'
        />
        <SubmitButton className='ms-2' variant='secondary'>Link Email</SubmitButton>
      </div>
    </Form>
  )
}

export function ApiKey ({ enabled, apiKey }) {
  const me = useMe()
  const [generateApiKey] = useMutation(
    gql`
      mutation generateApiKey($id: ID!) {
        generateApiKey(id: $id)
      }`,
    {
      update (cache, { data: { generateApiKey } }) {
        cache.modify({
          id: 'ROOT_QUERY',
          fields: {
            settings (existing) {
              return {
                ...existing,
                privates: {
                  ...existing.privates,
                  apiKey: generateApiKey,
                  authMethods: { ...existing.privates.authMethods, apiKey: generateApiKey }
                }
              }
            }
          }
        })
      }
    }
  )
  const [deleteApiKey] = useMutation(
    gql`
      mutation deleteApiKey($id: ID!) {
        deleteApiKey(id: $id) {
          id
        }
      }`,
    {
      update (cache, { data: { deleteApiKey } }) {
        cache.modify({
          id: 'ROOT_QUERY',
          fields: {
            settings (existing) {
              return {
                ...existing,
                privates: {
                  ...existing.privates,
                  authMethods: { ...existing.privates.authMethods, apiKey: null }
                }
              }
            }
          }
        })
      }
    }
  )

  const subject = '[API Key Request] <your title here>'
  const body =
  encodeURI(`**[API Key Request]**

Hi, I would like to use API keys with the [Stacker News GraphQL API](/api/graphql) for the following reasons:

...

I expect to call the following GraphQL queries or mutations:

... (you can leave empty if unknown)

I estimate that I will call the GraphQL API this many times (rough estimate is fine):

... (you can leave empty if unknown)
`)
  const metaLink = encodeURI(`/~meta/post?type=discussion&title=${subject}&text=${body}`)
  const mailto = `mailto:hello@stacker.news?subject=${subject}&body=${body}`
  // link to DM with k00b on Telegram
  const telegramLink = 'https://t.me/k00bideh'
  // link to DM with ek on SimpleX
  const simplexLink = 'https://simplex.chat/contact#/?v=1-2&smp=smp%3A%2F%2F6iIcWT_dF2zN_w5xzZEY7HI2Prbh3ldP07YTyDexPjE%3D%40smp10.simplex.im%2FxNnPk9DkTbQJ6NckWom9mi5vheo_VPLm%23%2F%3Fv%3D1-2%26dh%3DMCowBQYDK2VuAyEAnFUiU0M8jS1JY34LxUoPr7mdJlFZwf3pFkjRrhprdQs%253D%26srv%3Drb2pbttocvnbrngnwziclp2f4ckjq65kebafws6g4hy22cdaiv5dwjqd.onion'

  const disabled = !enabled

  return (
    <>
      <div className='form-label mt-3'>api key</div>
      <div className='mt-2 d-flex align-items-center'>
        {apiKey &&
          <>
            <CopyInput
              groupClassName='mb-0'
              readOnly
              noForm
              placeholder={apiKey}
            />
          </>}
        <OverlayTrigger
          placement='bottom'
          overlay={disabled ? <Tooltip>request access to API keys in ~meta</Tooltip> : <></>}
          trigger={['hover', 'focus']}
        >
          <div>
            {apiKey
              ? <DeleteIcon
                  style={{ cursor: 'pointer' }} className='fill-grey mx-1' width={24} height={24}
                  onClick={async () => {
                    await deleteApiKey({ variables: { id: me.id } })
                  }}
                />
              : (
                <Button
                  disabled={disabled} className={apiKey ? 'ms-2' : ''} variant='secondary' onClick={async () => {
                    await generateApiKey({ variables: { id: me.id } })
                  }}
                >Generate API key
                </Button>
                )}
          </div>
        </OverlayTrigger>
        <Info>
          <ul className='fw-bold'>
            <li>use API keys with our <Link target='_blank' href='/api/graphql'>GraphQL API</Link> for authentication</li>
            <li>you need to add the API key to the <span className='text-monospace'>X-API-Key</span> header of your requests</li>
            <li>you can currently only generate API keys if we enabled it for your account</li>
            <li>
              you can{' '}
              <Link target='_blank' href={metaLink} rel='noreferrer'>create a post in ~meta</Link> to request access
              or reach out to us via
              <ul>
                <li><Link target='_blank' href={mailto} rel='noreferrer'>email</Link></li>
                <li><Link target='_blank' href={telegramLink} rel='noreferrer'>Telegram</Link></li>
                <li><Link target='_blank' href={simplexLink} rel='noreferrer'>SimpleX</Link></li>
              </ul>
            </li>
            <li>please include following information in your request:
              <ul>
                <li>your nym on SN</li>
                <li>what you want to achieve with authenticated API access</li>
                <li>which GraphQL queries or mutations you expect to call</li>
                <li>your (rough) estimate how often you will call the GraphQL API</li>
              </ul>
            </li>
          </ul>
        </Info>
      </div>
    </>
  )
}
