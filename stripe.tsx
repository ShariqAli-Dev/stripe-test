import React, { ReactNode, useEffect, useRef, useState } from "react";
import {
  OnrampAppearanceOptions,
  StripeOnramp,
  loadStripeOnramp,
} from "@stripe/crypto";
import {
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
} from "../helpers/constants";
import axios from "axios";
import { Stripe } from "stripe";

async function getClientSecret() {
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2022-11-15",
    typescript: true,
  });

  const OnrampSessionResource = Stripe.StripeResource.extend({
    create: Stripe.StripeResource.method({
      method: "POST",
      path: "crypto/onramp_sessions",
    }),
  });

  const { data }: { data: { ip: string | undefined } } = await axios.get(
    "https://api.ipify.org/?format=json"
  );

  // the await IS necessary
  const onrampSession = await new OnrampSessionResource(stripe).create({
    transaction_details: {
      destination_currency: "usdc",
      destination_exchange_amount: "13.37",
      destination_network: "ethereum",
    },
    customer_ip_address: data.ip,
  });

  return (onrampSession as any).client_secret as string;
}

// APP.TSX
const stripeOnrampPromise: Promise<StripeOnramp | null> = loadStripeOnramp(
  STRIPE_PUBLISHABLE_KEY
);
export function StripeWidget() {
  const [clientSecret, setClientSecret] = useState<undefined | string>(
    undefined
  );

  useEffect(() => {
    if (!clientSecret) {
      getClientSecret().then((clientSecret) => {
        setClientSecret(clientSecret);
      });
    }
  }, []);

  if (!clientSecret) {
    return <div>loading</div>;
  }

  return (
    <CryptoElements stripeOnramp={stripeOnrampPromise}>
      <OnrampElement
        clientSecret={clientSecret}
        appearance={{ theme: "dark" }}
      />
    </CryptoElements>
  );
}

interface Context {
  onramp: StripeOnramp | null;
}

const CryptoElementsContext = React.createContext<Context | null>(null);
export function CryptoElements({
  stripeOnramp,
  children,
}: {
  stripeOnramp: Promise<StripeOnramp | null>;
  children: ReactNode;
}) {
  const [ctx, setContext] = useState<Context>({
    onramp: null,
  });

  useEffect(() => {
    let isMounted = true;

    Promise.resolve(stripeOnramp).then((onramp) => {
      if (onramp && isMounted) {
        setContext((ctx) => (ctx.onramp ? ctx : { onramp }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [stripeOnramp]);

  return (
    <CryptoElementsContext.Provider value={ctx}>
      {children}
    </CryptoElementsContext.Provider>
  );
}

export const useStripeOnramp = () => {
  const context = React.useContext(CryptoElementsContext);
  return context?.onramp;
};

export function OnrampElement({
  clientSecret,
  appearance,
  ...props
}: {
  clientSecret: string;
  appearance: OnrampAppearanceOptions;
}) {
  const stripeOnramp = useStripeOnramp();
  const onrampElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const containerRef = onrampElementRef.current;
    if (containerRef) {
      containerRef.innerHTML = "";

      if (clientSecret && stripeOnramp) {
        stripeOnramp
          .createSession({
            clientSecret,
            appearance,
          })
          .mount(containerRef);
      }
    }
  }, [clientSecret, stripeOnramp]);

  return <div {...props} ref={onrampElementRef}></div>;
}
