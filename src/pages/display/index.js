import React, { Component } from 'react'
import { Button, Primary, Secondary, Purchase } from '../../components/button'
import { HicetnuncContext } from '../../context/HicetnuncContext'
import { Page, Container, Padding } from '../../components/layout'
import { BottomBanner } from '../../components/bottom-banner'
import { Loading } from '../../components/loading'
import { renderMediaType } from '../../components/media-types'
import { Identicon } from '../../components/identicons'
import { walletPreview } from '../../utils/string'
import { PATH } from '../../constants'
import { VisuallyHidden } from '../../components/visually-hidden'
import { GetUserMetadata } from '../../data/api'
import { ResponsiveMasonry } from '../../components/responsive-masonry'
import InfiniteScroll from 'react-infinite-scroll-component'
import styles from './styles.module.scss'

const axios = require('axios')
const fetch = require('node-fetch')

const sortByTokenId = (a, b) => {
  return b.id - a.id
}

const getRestrictedAddresses = async () =>
  await axios
    .get(
      'https://raw.githubusercontent.com/hicetnunc2000/hicetnunc-reports/main/filters/w.json'
    )
    .then((res) => res.data)

const query_collection = `
query collectorGallery($address: String!) {
  hic_et_nunc_token_holder(where: {holder_id: {_eq: $address}, token: {creator: {address: {_neq: $address}}}, quantity: {_gt: "0"}}, order_by: {token_id: desc}) {
    token {
      id
      artifact_uri
      display_uri
      thumbnail_uri
      timestamp
      mime
      title
      description
      supply
      royalties
      creator {
        address
        name
      }
    }
  }
}
`

async function fetchGraphQL(operationsDoc, operationName, variables) {
  let result = await fetch(process.env.REACT_APP_GRAPHQL_API, {
    method: 'POST',
    body: JSON.stringify({
      query: operationsDoc,
      variables: variables,
      operationName: operationName,
    }),
  })
  return await result.json()
}

async function fetchCollection(addr) {
  const { errors, data } = await fetchGraphQL(
    query_collection,
    'collectorGallery',
    { address: addr }
  )
  if (errors) {
    console.error(errors)
  }
  const result = data.hic_et_nunc_token_holder
  // console.log('collection result' + { result })
  return result
}

const query_creations = `
query creatorGallery($address: String!) {
  hic_et_nunc_token(where: {creator: {address: {_eq: $address}}, supply: {_gt: 0}}, order_by: {id: desc}) {
    id
    artifact_uri
    display_uri
    mime
    title
    description
    supply
    swaps(order_by: {price: asc}, limit: 1, where: {amount_left: {_gte: "1"}, status: {_eq: "0"}}) {
      id
      status
      amount_left
      creator_id
      contract_version
      creator {
        address
      }
      price
    }
  }
}
`

const query_subjkts = `
query subjktsQuery($subjkt: String!) {
  hic_et_nunc_holder(where: { name: {_eq: $subjkt}}) {
    address
    name
    hdao_balance
    metadata
    metadata_file
  }
}
`

const query_tz = `
query addressQuery($address: String!) {
  hic_et_nunc_holder(where: { address: {_eq: $address}}) {
    address
    name
    hdao_balance
    metadata
    metadata_file
  }
}
`

const query_v1_swaps = `
query querySwaps($address: String!) {
  hic_et_nunc_swap(where: {contract_version: {_eq: "1"}, creator_id: {_eq: $address}, status: {_eq: "0"}}) {
    token {
      id
      title
      creator {
        address
      }
      creator_id
    }
    creator {
      address
    }
    creator_id
    amount_left
    price
    id
    token_id
    contract_version
  }
}
`

const query_v2_swaps = `
query querySwaps($address: String!) {
  hic_et_nunc_swap(where: {token: {creator: {address: {_neq: $address}}}, creator_id: {_eq: $address}, status: {_eq: "0"}, contract_version: {_eq: "2"}}, distinct_on: token_id) {
    creator_id
    token {
      id
      title
      artifact_uri
      display_uri
      mime
      description
      supply
      royalties
      creator {
        name
        address
      }
    }
    amount_left
    price
    id
  }
}
`

async function fetchV1Swaps(address) {
  const { errors, data } = await fetchGraphQL(query_v1_swaps, 'querySwaps', {
    address: address
  })
  if (errors) {
    console.error(errors)
  }
  const result = data.hic_et_nunc_swap
  // console.log('swapresultv1 ' + JSON.stringify(result))
  return result
}

async function fetchV2Swaps(address) {

  const { errors, data } = await fetchGraphQL(query_v2_swaps, 'querySwaps', {
    address: address
  })
  if (errors) {
    console.error(errors)
  }
  const result = data.hic_et_nunc_swap
  // console.log('swapresultv2 ' + JSON.stringify(result))

  return result
}

async function fetchSubjkts(subjkt) {
  const { errors, data } = await fetchGraphQL(query_subjkts, 'subjktsQuery', {
    subjkt: subjkt,
  })
  if (errors) {
    console.error(errors)
  }
  const result = data.hic_et_nunc_holder
  /* console.log({ result }) */
  return result
}

async function fetchCreations(addr) {
  const { errors, data } = await fetchGraphQL(
    query_creations,
    'creatorGallery',
    { address: addr }
  )
  if (errors) {
    console.error(errors)
  }
  const result = data.hic_et_nunc_token
  /* console.log({ result }) */
  return result
}

async function fetchTz(addr) {
  const { errors, data } = await fetchGraphQL(query_tz, 'addressQuery', {
    address: addr,
  })
  if (errors) {
    console.error(errors)
  }
  const result = data.hic_et_nunc_holder
  // console.log({ result })
  return result
}

export default class Display extends Component {
  static contextType = HicetnuncContext

  state = {
    wallet: '',
    walletPrev:
      window.location.pathname.split('/')[1] === 'tz'
        ? walletPreview(window.location.pathname.split('/')[2])
        : window.location.pathname.split('/')[1],
    subjkt: '',
    render: false,
    loading: true,
    hasMore: true,
    rstricted: false,
    offset: 0,
    results: [],
    objkts: [],
    creations: [],
    collection: [],
    forSale: [],
    notForSale: [],
    marketV1: [],
    items: [],
    creationsState: true,
    collectionState: false,
    collectionType: 'notForSale',
    hdao: 0,
  }

  componentWillMount = async () => {

    const id = window.location.pathname.split('/')[1]
    // console.log(window.location.pathname.split('/'))

    if (id === 'tz') {

      const wallet = window.location.pathname.split('/')[2]
      this.setState({
        wallet,
        walletPreview: walletPreview(wallet),
      })
      //let res = await fetchSubjkts(decodeURI(window.location.pathname.split('/')[1]))
      // console.log(decodeURI(window.location.pathname.split('/')[1]))
      await GetUserMetadata(wallet).then((data) => {
        const {
          twitter,
          tzprofile,
          discord,
          github,
          dns,
        } = data.data

        if (data.data.twitter) this.setState({ twitter })
        if (data.data.tzprofile) this.setState({ tzprofile })
        if (data.data.discord) this.setState({ discord, copied: false })
        if (data.data.github) this.setState({ github })
        if (data.data.dns) this.setState({ dns })
      })

      let res = await fetchTz(wallet)
      try {
        if (res[0]) {
          let meta = await axios.get('https://cloudflare-ipfs.com/ipfs/' + res[0].metadata_file.split('//')[1]).then(res => res.data)

          if (meta.description) this.setState({ description: meta.description })
          if (meta.identicon) this.setState({ identicon: meta.identicon })
          if (res[0]) this.setState({ subjkt: res[0].name })
          if (res[0]) this.setState({ hdao: Math.floor(res[0].hdao_balance / 1000000) })
        }
      } catch (e) {
        console.log("error " + e)
      }


      this.onReady()
    } else {
      let res = await fetchSubjkts(decodeURI(window.location.pathname.split('/')[1]))
      // console.log(decodeURI(window.location.pathname.split('/')[1]))
      console.log(res)
      if (res[0].metadata_file) {
        let meta = await axios.get('https://cloudflare-ipfs.com/ipfs/' + res[0].metadata_file.split('//')[1]).then(res => res.data)
        console.log(meta)
        if (meta.description) this.setState({ description: meta.description })
        if (meta.identicon) this.setState({ identicon: meta.identicon })
      }

      if (res.length >= 1) {
        console.log(res)

        this.setState({
          wallet: res[0].address,
          walletPreview: walletPreview(res[0].address),
          subjkt: window.location.pathname.split('/')[1]
        })

        let resTz = await fetchTz(this.state.wallet)
        this.setState({ hdao: Math.floor(resTz[0].hdao_balance / 1000000) })
      } else {
        this.props.history.push('/')
      }

      await GetUserMetadata(this.state.wallet).then((data) => {
        const {
          dns,
          github,
          discord,
          twitter,
          tzprofile
        } = data.data
        if (data.data.dns) this.setState({ dns })
        if (data.data.github) this.setState({ github })
        if (data.data.discord) this.setState({ discord })
        if (data.data.twitter) this.setState({ twitter })
        if (data.data.tzprofile) this.setState({ tzprofile })
      })
      this.onReady()
    }
  }

  reset() {
    this.setState({
      items: [],
      objkts: [],
      render: false,
      loading: true,
      hasMore: true,
    })
  }

  creations = async () => {
    this.setState({
      creationsState: true,
      collectionState: false,
      collectionType: 'notForSale'
    })

    this.reset()

    let list = await getRestrictedAddresses()
    // console.log(this.state.wallet)
    // console.log(!list.includes(this.state.wallet))
    if (!list.includes(this.state.wallet)) {
      this.setState({ creations: await fetchCreations(this.state.wallet) })
      this.setState({ objkts: this.state.creations, loading: false, items: [] })
      this.setState({ marketV1: await fetchV1Swaps(this.state.wallet) })
    } else {
      this.setState({ restricted: true, loading: false })
    }

    this.setState({ items: this.state.objkts.slice(0, 15), offset: 15 })

    if (this.state.subjkt !== '') {
      // if alias route
      this.props.history.push(`/${this.state.subjkt}/creations`)
    } else {
      // if tz/wallethash route
      this.props.history.push(`/tz/${this.state.wallet}/creations`)
    }
  }

  creationsNotForSale = async () => {
    this.setState({ collectionType: 'notForSale' })

    this.setState({
      objkts: await this.filterCreationsNotForSale(this.state.objkts), loading: false, items: []
    })

    this.setState({ items: this.state.objkts.slice(0, 15), offset: 15 })
  }

  filterCreationsNotForSale = async () => {
    // console.log(JSON.stringify(this.state.creations[0]))
    let objkts = this.state.creations.filter(item => {
      return item.swaps.length === 0
    });

    return objkts
  }

  creationsForSale = async (forSaleType) => {
    this.setState({ collectionType: 'forSale' })

    let v1Swaps = this.state.marketV1.filter(item => {
      const objkts = item.token.creator.address == this.state.wallet
      return objkts
    })

    this.setState({ marketV1: v1Swaps, loading: false })
    this.setState({ objkts: this.state.creations, loading: false, items: [] })

    if (forSaleType !== null) {
      if (forSaleType == 0) {
        this.setState({
          objkts: await this.filterCreationsForSalePrimary(this.state.objkts)
        })
      } else if (forSaleType == 1) {
        this.setState({
          objkts: await this.filterCreationsForSaleSecondary(this.state.objkts)
        })
      }
    } else {
      console.log("forSaleType is null")
    }

    this.setState({ items: this.state.objkts.slice(0, 15), offset: 15 })
  }

  filterCreationsForSalePrimary = async () => {
    let objkts = this.state.creations.filter(item => {
      const swaps = item.swaps.filter(swaps => {
        return swaps.status == 0 && swaps.contract_version == 2 && swaps.creator_id == this.state.wallet
      })
      return swaps && swaps.length > 0
    });

    return objkts
  }

  filterCreationsForSaleSecondary = async () => {
    let objkts = this.state.creations.filter(item => {
      const swaps = item.swaps.filter(swaps => {
        return swaps.status == 0 && swaps.creator_id !== this.state.wallet
      })
      return swaps && swaps.length > 0
    });

    return objkts
  }

  combineCollection = async (collection, swaps) => {
    let combinedCollection = [];

    collection.forEach(function (item) {
      combinedCollection.push(item)
    })

    swaps.forEach(function (item) {
      combinedCollection.push(item)
    })

    return combinedCollection;
  }

  sortCollection = async (unsorted) => {
    unsorted.sort(function (a, b) {
      return b.token.id - a.token.id
    })
  }

  collectionFull = async () => {
    this.reset()

    this.setState({
      creationsState: false,
      collectionState: true
    })

    this.setState({ collectionType: 'notForSale' })

    let list = await getRestrictedAddresses()

    if (!list.includes(this.state.wallet)) {
      this.setState({ loading: false, items: [] })
      let collection = await fetchCollection(this.state.wallet)
      let swaps = await fetchV2Swaps(this.state.wallet)
      // console.log(swaps)
      let combinedCollection = await this.combineCollection(collection, swaps)
      this.sortCollection(combinedCollection)
      this.setState({ collection: combinedCollection })
      this.setState({ marketV1: await fetchV1Swaps(this.state.wallet) })
    } else {
      this.setState({ restricted: true, loading: false })
    }

    this.setState({ objkts: this.state.collection, loading: false, items: [] })
    this.setState({ items: this.state.objkts.slice(0, 15), offset: 15 })

    if (this.state.subjkt !== '') {
      // if alias route
      this.props.history.push(`/${this.state.subjkt}/collection`)
    } else {
      // if tz/wallethash route
      this.props.history.push(`/tz/${this.state.wallet}/collection`)
    }
  }

  collectionForSale = async () => {
    this.setState({ collectionType: 'forSale' })

    let v1Swaps = this.state.marketV1.filter(item => {
      const objkts = item.token.creator.address !== this.state.wallet
      return objkts
    })

    this.setState({ marketV1: v1Swaps, loading: false })

    this.setState({ objkts: await this.filterCollectionForSale(this.state.objkts), loading: false, items: [] })
    this.setState({ items: this.state.objkts.slice(0, 15), offset: 15 })
  }

  collectionNotForSale = async () => {
    this.reset();
    this.setState({ collectionType: 'notForSale' })

    this.setState({ objkts: await this.filterCollectionNotForSale(this.state.objkts), loading: false, items: [] })
    this.setState({ items: this.state.objkts.slice(0, 15), offset: 15 })
  }

  filterCollectionNotForSale = async () => {
    let objktsNotForSale = this.state.collection.filter(item => item.token.creator.address !== this.state.wallet && item.creator_id !== this.state.wallet)
    return objktsNotForSale
  }

  filterCollectionForSale = async () => {
    let objktsForSale = this.state.collection.filter(item => item.creator_id == this.state.wallet)
    return objktsForSale
  }

  // called if there's no redirect
  onReady = async () => {

    // based on route, define initial state
    if (this.state.subjkt !== '') {
      // if alias route
      if (window.location.pathname.split('/')[2] === 'creations') {
        this.creations()
      } else if (window.location.pathname.split('/')[2] === 'collection') {
        this.collectionFull()
      } else {
        this.creations()
      }
    } else {
      // if tz wallet route
      if (window.location.pathname.split('/')[3] === 'creations') {
        this.creations()
      } else if (window.location.pathname.split('/')[3] === 'collection') {
        this.collectionFull()
      } else {
        this.creations()
      }
    }
  }

  loadMore = () => {
    this.setState({ items: this.state.items.concat(this.state.objkts.slice(this.state.offset, this.state.offset + 20)), offset: this.state.offset + 20 })
  }

  cancel_batch = async () => {
    this.context.batch_cancel(this.state.marketV1.slice(0, 10))
  }

  getDiscordTooltip() {
    const handleSize = this.state.discord.length;
    const missingSize = handleSize - 6;
    const spaces = ' '.repeat(Math.ceil(Math.abs(missingSize / 2)));
    if (missingSize < 0) {
      return `${this.state.copied ? 'Copied' : `${spaces}${this.state.discord}${spaces}`}`;
    } else {
      return `${this.state.copied ? `${spaces}Copied${spaces}` : `${this.state.discord}`}`;
    }
  }

  render() {
    return (
      <Page title={this.state.alias}>
        <Container>
          <Padding>
            <div className={styles.profile}>
              <Identicon address={this.state.wallet} logo={this.state.identicon} />

              <div className={styles.info}>
                {this.state.alias && !this.state.subjkt ? (
                  <p>
                    <strong>{this.state.alias}</strong>
                  </p>
                ) : (
                  <p>
                    <strong>{this.state.subjkt}</strong>
                  </p>
                )}
                {this.state.description && <p>{this.state.description}</p>}
                <Button href={`https://tzkt.io/${this.state.wallet}`}>
                  <Primary>{walletPreview(this.state.wallet)}</Primary>
                </Button>

                <p>{this.state.hdao} ○</p>

                <div>
                  {/* 
                  {this.state.telegram && (
                    <Button href={`https://t.me/${this.state.telegram}`}>
                      <VisuallyHidden>{`https://t.me/${this.state.telegram}`}</VisuallyHidden>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        style={{
                          fill: 'var(--text-color)',
                          stroke: 'transparent',
                          marginRight: '10px',
                        }}
                      >
                        <path d="M9.78,18.65L10.06,14.42L17.74,7.5C18.08,7.19 17.67,7.04 17.22,7.31L7.74,13.3L3.64,12C2.76,11.75 2.75,11.14 3.84,10.7L19.81,4.54C20.54,4.21 21.24,4.72 20.96,5.84L18.24,18.65C18.05,19.56 17.5,19.78 16.74,19.36L12.6,16.3L10.61,18.23C10.38,18.46 10.19,18.65 9.78,18.65Z"></path>
                      </svg>
                    </Button>
                  )} */}
                  {this.state.twitter && (
                    <Button href={`https://twitter.com/${this.state.twitter}`}>
                      <VisuallyHidden>{`https://twitter.com/${this.state.twitter}`}</VisuallyHidden>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        style={{
                          fill: 'var(--text-color)',
                          stroke: 'transparent',
                          marginRight: '10px',
                        }}
                      >
                        <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334 0-.14 0-.282-.006-.422A6.685 6.685 0 0 0 16 3.542a6.658 6.658 0 0 1-1.889.518 3.301 3.301 0 0 0 1.447-1.817 6.533 6.533 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.325 9.325 0 0 1-6.767-3.429 3.289 3.289 0 0 0 1.018 4.382A3.323 3.323 0 0 1 .64 6.575v.045a3.288 3.288 0 0 0 2.632 3.218 3.203 3.203 0 0 1-.865.115 3.23 3.23 0 0 1-.614-.057 3.283 3.283 0 0 0 3.067 2.277A6.588 6.588 0 0 1 .78 13.58a6.32 6.32 0 0 1-.78-.045A9.344 9.344 0 0 0 5.026 15z" />
                      </svg>
                    </Button>
                  )}
                  {/* {this.state.instagram && (
                    <Button
                      href={`https://instagram.com/${this.state.instagram}`}
                    >
                      <VisuallyHidden>{`https://instagram.com/${this.state.instagram}`}</VisuallyHidden>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        style={{
                          fill: 'var(--text-color)',
                          stroke: 'transparent',
                          marginRight: '10px',
                        }}
                      >
                        <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z" />
                      </svg>
                    </Button>
                  )}
                  {this.state.reddit && (
                    <Button href={`https://reddit.com/${this.state.reddit}`}>
                      <VisuallyHidden>{`https://reddit.com/${this.state.reddit}`}</VisuallyHidden>
                      <svg
                        height="16"
                        viewBox="0 0 512 512"
                        width="16"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                          fill: 'var(--text-color)',
                          stroke: 'transparent',
                          marginRight: '10px',
                        }}
                      >
                        <path d="m309.605469 343.347656c-11.46875 11.46875-36.042969 15.5625-53.554688 15.5625-17.5625 0-42.085937-4.09375-53.554687-15.5625-2.714844-2.714844-7.066406-2.714844-9.777344 0-2.714844 2.714844-2.714844 7.066406 0 9.777344 18.175781 18.175781 53.09375 19.609375 63.332031 19.609375s45.105469-1.433594 63.335938-19.609375c2.660156-2.714844 2.660156-7.066406 0-9.777344-2.714844-2.714844-7.066407-2.714844-9.78125 0zm0 0" />
                        <path d="m224 282.675781c0-14.695312-11.980469-26.675781-26.675781-26.675781-14.691407 0-26.675781 11.980469-26.675781 26.675781 0 14.691407 11.984374 26.675781 26.675781 26.675781 14.695312 0 26.675781-11.980468 26.675781-26.675781zm0 0" />
                        <path d="m256 0c-141.363281 0-256 114.636719-256 256s114.636719 256 256 256 256-114.636719 256-256-114.636719-256-256-256zm148.53125 290.148438c.5625 3.6875.871094 7.425781.871094 11.214843 0 57.445313-66.867188 103.988281-149.351563 103.988281s-149.351562-46.542968-149.351562-103.988281c0-3.839843.308593-7.628906.871093-11.316406-13.003906-5.835937-22.066406-18.890625-22.066406-34.046875 0-20.582031 16.691406-37.324219 37.324219-37.324219 10.035156 0 19.097656 3.941407 25.804687 10.394531 25.90625-18.6875 61.75-30.621093 101.632813-31.644531 0-.511719 18.636719-89.292969 18.636719-89.292969.359375-1.738281 1.382812-3.226562 2.867187-4.195312 1.484375-.972656 3.277344-1.28125 5.019531-.921875l62.054688 13.207031c4.351562-8.804687 13.308594-14.898437 23.804688-14.898437 14.746093 0 26.675781 11.929687 26.675781 26.675781s-11.929688 26.675781-26.675781 26.675781c-14.285157 0-25.855469-11.265625-26.519532-25.394531l-55.554687-11.828125-16.996094 80.027344c39.167969 1.378906 74.34375 13.257812 99.839844 31.691406 6.707031-6.5 15.820312-10.496094 25.90625-10.496094 20.636719 0 37.324219 16.691407 37.324219 37.324219 0 15.257812-9.164063 28.3125-22.117188 34.148438zm0 0" />
                        <path d="m314.675781 256c-14.695312 0-26.675781 11.980469-26.675781 26.675781 0 14.691407 11.980469 26.675781 26.675781 26.675781 14.691407 0 26.675781-11.984374 26.675781-26.675781 0-14.695312-11.980468-26.675781-26.675781-26.675781zm0 0" />
                      </svg>
                    </Button>
                  )} */}
                  {this.state.tzprofile && (
                    <Button href={`https://tzprofiles.com/view/${this.state.tzprofile}`}>
                      <VisuallyHidden>{`https://tzprofiles.com/view/${this.state.tzprofile}`}</VisuallyHidden>
                      <svg
                        height="16"
                        viewBox="0 0 16 16"
                        width="16"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                          fill: 'var(--text-color)',
                          stroke: 'transparent',
                          marginRight: '10px',
                        }}
                      >

                        <g>
                          <rect x="1" y="1" width="9" height="14" />
                          <rect x="1" y="1" width="14" height="9" />
                        </g>
                      </svg>
                    </Button>
                  )}
                  {this.state.discord && (
                    <Button onClick={() => {
                      this.setState({ copied: true })
                      setTimeout(() => this.setState({ copied: false }), 1000)
                      navigator.clipboard.writeText(this.state.discord)
                    }}>
                      <Primary>
                        <span
                          className={styles.top}
                          data-position={'top'}
                          data-tooltip={this.getDiscordTooltip()}
                          style={{
                            marginRight: '10px',
                          }}
                        >
                          <VisuallyHidden>{`${this.state.discord}`}</VisuallyHidden>
                          <svg
                            width="20"
                            height="15"
                            viewBox="0 0 20 15"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              fill: 'var(--text-color)',
                              stroke: 'transparent',
                            }}
                          >
                            <path d="M16.9308 1.24342C15.6561 0.667894 14.2892 0.243873 12.8599 0.00101874C12.8339 -0.00366827 12.8079 0.00804483 12.7945 0.0314716C12.6187 0.339138 12.4239 0.740513 12.2876 1.05599C10.7503 0.829542 9.22099 0.829542 7.71527 1.05599C7.57887 0.733501 7.37707 0.339138 7.20048 0.0314716C7.18707 0.00882646 7.16107 -0.00288664 7.13504 0.00101874C5.70659 0.243097 4.33963 0.667118 3.06411 1.24342C3.05307 1.2481 3.04361 1.25592 3.03732 1.26606C0.444493 5.07759 -0.265792 8.79544 0.0826501 12.4672C0.0842267 12.4852 0.0944749 12.5023 0.108665 12.5133C1.81934 13.7494 3.47642 14.4998 5.10273 14.9973C5.12876 15.0051 5.15634 14.9957 5.1729 14.9746C5.55761 14.4577 5.90054 13.9126 6.19456 13.3394C6.21192 13.3059 6.19535 13.266 6.15989 13.2528C5.61594 13.0497 5.098 12.8022 4.59977 12.5211C4.56037 12.4984 4.55721 12.443 4.59347 12.4164C4.69831 12.3391 4.80318 12.2587 4.9033 12.1775C4.92141 12.1626 4.94665 12.1595 4.96794 12.1689C8.24107 13.6393 11.7846 13.6393 15.0191 12.1689C15.0404 12.1587 15.0657 12.1619 15.0846 12.1767C15.1847 12.2579 15.2895 12.3391 15.3952 12.4164C15.4314 12.443 15.4291 12.4984 15.3897 12.5211C14.8914 12.8076 14.3735 13.0497 13.8288 13.252C13.7933 13.2653 13.7775 13.3059 13.7949 13.3394C14.0952 13.9118 14.4381 14.4569 14.8157 14.9738C14.8315 14.9957 14.8599 15.0051 14.8859 14.9973C16.5201 14.4998 18.1772 13.7494 19.8879 12.5133C19.9028 12.5023 19.9123 12.4859 19.9139 12.468C20.3309 8.22302 19.2154 4.53566 16.9568 1.26684C16.9513 1.25592 16.9419 1.2481 16.9308 1.24342ZM6.68335 10.2315C5.69792 10.2315 4.88594 9.34128 4.88594 8.24802C4.88594 7.15476 5.68217 6.26456 6.68335 6.26456C7.69239 6.26456 8.49651 7.16258 8.48073 8.24802C8.48073 9.34128 7.68451 10.2315 6.68335 10.2315ZM13.329 10.2315C12.3435 10.2315 11.5316 9.34128 11.5316 8.24802C11.5316 7.15476 12.3278 6.26456 13.329 6.26456C14.338 6.26456 15.1421 7.16258 15.1264 8.24802C15.1264 9.34128 14.338 10.2315 13.329 10.2315Z" />
                          </svg>
                        </span>
                      </Primary>
                    </Button>
                  )}
                  {this.state.github && (
                    <Button href={`https://github.com/${this.state.github}`}>
                      <VisuallyHidden>{`https://github.com/${this.state.github}`}</VisuallyHidden>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        style={{
                          fill: 'var(--text-color)',
                          stroke: 'transparent',
                          marginRight: '10px',
                        }}
                      >
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                      </svg>
                    </Button>
                  )}
                  {this.state.dns && (
                    <Button href={`http://${this.state.dns}`}>
                      <VisuallyHidden>{this.state.dns}</VisuallyHidden>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        style={{
                          fill: 'var(--text-color)',
                          stroke: 'transparent',
                          marginRight: '10px',
                        }}
                      >
                        <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Padding>
        </Container>

        <Container>
          <Padding>
            <p>
            </p>
            <div className={styles.menu}>
              <Button onClick={this.creations}>
                <Primary selected={this.state.creationsState}>
                  creations
                </Primary>
              </Button>
              <Button onClick={this.collectionFull}>
                <Primary selected={this.state.collectionState}>
                  collection
                </Primary>
              </Button>
              <div className={styles.filter}>
                <Button onClick={() => this.setState({
                  filter: !this.state.filter
                })}>
                  <Primary>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-filter">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                    </svg>
                  </Primary>
                </Button>
              </div>
            </div>
          </Padding>
        </Container>

        {this.state.loading && (
          <Container>
            <Padding>
              <Loading />
            </Padding>
          </Container>
        )}

        {
          !this.state.loading && this.state.restricted && (
            <Container>
              <Padding>
                <div style={{ color: 'white', background: 'black', textAlign: 'center' }}>
                  restricted account
                </div>
              </Padding>
            </Container>
          )
        }

        {!this.state.loading && this.state.creationsState && (
          <div>
            <Container>
              {this.state.filter && (
                <Padding>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      onClick={() => { this.creations() }}>
                      <div className={styles.tag}>
                        all
                      </div>
                    </Button>
                    <Button
                      onClick={() => {
                        this.creationsForSale(0);
                      }}>
                      <div className={styles.tag}>
                        primary
                      </div>
                    </Button>
                    <Button
                      onClick={() => {
                        this.creationsForSale(1);
                      }}>
                      <div className={styles.tag}>
                        secondary
                      </div>
                    </Button>
                    <Button
                      onClick={() => { this.creationsNotForSale() }}>
                      <div className={styles.tag}>
                        not for sale
                      </div>
                    </Button>
                  </div>
                </Padding>
              )}
            </Container>
            <Container xlarge>
              {this.state.collectionType == 'forSale' ?
                <>
                  {this.context.acc != null && this.context.acc.address == this.state.wallet ?
                    <>
                      {Object.keys(this.state.marketV1).length !== 0 && (
                        <>
                          <Container>
                            <Padding>
                              <p>We're currently migrating the marketplace smart contract. We ask for
                                users to cancel their listings as the v1 marketplace will no longer be
                                maintained. Auditing tools for the v1 protocol can be found at <a href='https://hictory.xyz'>hictory.xyz</a>
                              </p>
                            </Padding>
                          </Container>
                        </>
                      )}

                      {this.state.marketV1.length !== 0 ?
                        <Container>
                          <Padding>
                            <p>
                              One can delist multiple swaps in once batch transaction or delist each single one at a time.
                            </p>
                            <br />
                            <Button onClick={this.cancel_batch}>
                              <Primary>
                                Batch Cancel
                              </Primary>
                            </Button>
                          </Padding>
                        </Container>
                        :
                        null
                      }

                      {this.state.marketV1.map((e, key) => {
                        // console.log(e)
                        return (
                          <>
                            <Container key={key}>
                              <Padding>
                                <Button to={`${PATH.OBJKT}/${e.token_id}`}>
                                  {/* {console.log(e)} */}
                                  <Primary>
                                    <strong>{e.amount_left}x OBJKT#{e.token_id} {e.price}µtez</strong>
                                  </Primary>
                                </Button>
                                <Button onClick={() => this.context.cancel(e.id)}>
                                  <Secondary>
                                    Cancel Swap
                                  </Secondary>
                                </Button>
                              </Padding>
                            </Container>
                          </>
                        )
                      })
                      }
                    </> : null}
                </>
                :
                null
              }

              <InfiniteScroll
                dataLength={this.state.items.length}
                next={this.loadMore}
                hasMore={this.state.hasMore}
                loader={undefined}
                endMessage={undefined}
              >
                <ResponsiveMasonry>
                  {this.state.items.map((nft) => {
                    // console.log('swaps ' + JSON.stringify(nft))
                    return (
                      <div className={styles.cardContainer}>
                        <Button
                          style={{ positon: 'relative' }}
                          key={nft.id}
                          to={`${PATH.OBJKT}/${nft.id}`}>
                          <div className={styles.container}>
                            {renderMediaType({
                              mimeType: nft.mime,
                              artifactUri: nft.artifact_uri,
                              displayUri: nft.display_uri,
                              displayView: true
                            })}
                          </div>
                        </Button>
                        {/* <div className={styles.cardContainer}>
                          <div className={styles.card}>
                            <div className={styles.cardText}>
                              <div>OBJKT#{nft.id}</div>
                              <div className={styles.cardTitle}>{nft.title}</div>
                            </div>
                            <div className={styles.cardCollect}>
                              <Button onClick={() => this.context.collect(nft.swaps[0].id, nft.swaps[0].price)}>
                                <Purchase>
                                  <div className={styles.cardCollectPrice}>
                                    {nft.swaps && nft.swaps.length > 0 ? 'collect for ' + nft.swaps[0].price / 1000000 + ' tez' : 'not for sale'}
                                  </div>
                                </Purchase>
                              </Button>
                            </div>
                          </div>
                        </div> */}
                      </div>
                    )
                  })}
                </ResponsiveMasonry>
              </InfiniteScroll>
            </Container>
          </div>
        )}

        {!this.state.loading && this.state.collectionState && (
          <div>
            <Container>
              {this.state.filter && (
                <Padding>
                  <div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        onClick={() => { this.collectionFull() }}>
                        <div className={styles.tag}>
                          all
                        </div>
                      </Button>
                      <Button onClick={() => { this.collectionForSale() }}>
                        <div className={styles.tag}>
                          for sale
                        </div>
                      </Button>
                      <Button onClick={() => { this.collectionNotForSale() }}>
                        <div className={styles.tag}>
                          not for sale
                        </div>
                      </Button>
                    </div>
                  </div>
                </Padding>
              )}
            </Container>
            <Container xlarge>

              {this.state.collectionType == 'forSale' ?
                <>
                  {this.context.acc != null && this.context.acc.address == this.state.wallet ?
                    <>
                      {Object.keys(this.state.marketV1).length !== 0 && (
                        <>
                          <Container>
                            <Padding>
                              <p>We're currently migrating the marketplace smart contract. We ask for
                                users to cancel their listings as the v1 marketplace will no longer be
                                maintained. Auditing tools for the v1 protocol can be found at <a href='https://hictory.xyz'>hictory.xyz</a>
                              </p>
                            </Padding>
                          </Container>
                        </>
                      )}

                      {this.state.marketV1.length !== 0 ?
                        <Container>
                          <Padding>
                            <p>
                              One can delist multiple swaps in once batch transaction or delist each single one at a time.
                            </p>
                            <br />
                            <Button onClick={this.cancel_batch}>
                              <Primary>
                                Batch Cancel
                              </Primary>
                            </Button>
                          </Padding>
                        </Container>
                        :
                        null
                      }

                      {this.state.marketV1.map((e, key) => {
                        // console.log(e)
                        return (
                          <>
                            <Container key={key}>
                              <Padding>
                                <Button to={`${PATH.OBJKT}/${e.token_id}`}>
                                  {/* {console.log(e)} */}
                                  <Primary>
                                    <strong>{e.amount_left}x OBJKT#{e.token_id} {e.price}µtez</strong>
                                  </Primary>
                                </Button>
                                <Button onClick={() => this.context.cancel(e.id)}>
                                  <Secondary>
                                    Cancel Swap
                                  </Secondary>
                                </Button>
                              </Padding>
                            </Container>
                          </>
                        )
                      })
                      }
                    </> : null}
                </>
                :
                null
              }

              <InfiniteScroll
                dataLength={this.state.items.length}
                next={this.loadMore}
                hasMore={this.state.hasMore}
                loader={undefined}
                endMessage={<p></p>}
              >
                <ResponsiveMasonry>
                  {this.state.items.map((nft) => {
                    //console.log('nft: ' + JSON.stringify(nft))
                    return (
                      <div className={styles.cardContainer}>
                        <Button
                          style={{ position: 'relative' }}
                          key={nft.token.id}
                          to={`${PATH.OBJKT}/${nft.token.id}`}>
                          <div className={styles.container}>
                            {renderMediaType({
                              mimeType: nft.token.mime,
                              artifactUri: nft.token.artifact_uri,
                              displayUri: nft.token.display_uri,
                              displayView: true
                            })}
                          </div>
                        </Button>
                        {/*                       <div className={styles.card}>
                        <div className={styles.cardText}>
                          <div>OBJKT#{nft.token.id}</div>
                          <div>{nft.token.title}</div>
                          <div>{nft.token.creator.name}</div>
                        </div>
                        <div className={styles.cardCollect}>
                          <Button onClick={() => this.context.collect(nft.id, nft.price)}>
                            <Purchase>
                              <div className={styles.cardCollectPrice}>
                                {nft.price ? 'collect for ' + nft.price / 1000000 : 'not for sale'}
                              </div>
                            </Purchase>
                          </Button>
                        </div>
                      </div> */}
                      </div>
                    )
                  })}
                </ResponsiveMasonry>
              </InfiniteScroll>
            </Container>
          </div>
        )}
        {/*       <BottomBanner>
        API is down due to heavy server load — We're working to fix the issue — please be patient with us. <a href="https://discord.gg/mNNSpxpDce" target="_blank">Join the discord</a> for updates.
      </BottomBanner> */}
      </Page>
    )
  }
}