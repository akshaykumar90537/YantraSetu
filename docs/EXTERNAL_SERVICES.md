# External services and owner decisions

No paid service is enabled. Checked official public documentation on 30 October 2026. Pricing/eligibility can change and must be rechecked at signup.

## SMS/OTP findings

| Option | What official documentation establishes | Current decision |
|---|---|---|
| Local development adapter | No outbound API; synthetic OTPs are visibly returned and notification records say SIMULATED_NOT_SENT | Implemented; no provider charge |
| MSG91 SMS/OTP | SMS/OTP use country-based credits. Demo SMS are advertised, but a guaranteed free quota and account eligibility were not established. Custom sender/template routes involve DLT. | Candidate only; not activated |
| MSG91 default OTP widget | Separate documentation describes a default Free Plan and provider-managed default configuration, while country dial-plan charges and wallet deductions also apply. | Do not equate “Free Plan” with unlimited free live OTP or assume it covers booking notifications |
| Twilio trial | Official documentation lists 30-day expiry, selected-country availability, up to five verified recipients, and predefined message content | Limited testing candidate only; Indian signup/delivery eligibility and available units require account confirmation |

Official sources:
- https://msg91.com/help/all-service-deductions-/
- https://images.msg91.com/sms-pricing/India
- https://msg91.com/help/dlt-registration-in-india/dlt-faqs
- https://msg91.com/help/sendotp/how-to-integrate-the-new-login-with-otp-widget/msg91-otp-widget-subscription-
- https://www.twilio.com/docs/usage/trials

MSG91 documentation distinguishes conventional custom DLT routes from its default OTP-widget setup. Do not generalize one route's registration or price terms to every service. No exact live-cost quote or free entitlement has been established for this project's account.

## USER INPUT REQUIRED — when preparing live delivery

**Feature:** Real OTP and SMS booking notifications.

**Why I need your input:** These require an external account, delivery eligibility, and potentially paid credits/registration. The current local adapter sends nothing.

**What I need:** Whether live SMS is required for judging; whether you already have a provider account; whether you authorize evaluating a provider's exact account-level terms. Do not paste keys here.

**Recommended option:** Continue the zero-cost local simulation until live delivery is explicitly required. Then evaluate MSG91's API options for both authentication and booking notifications, verifying route/DLT requirements and a total quote before any purchase.

**Free alternative:** The implemented local adapter. A provider trial may be useful if eligible, but its limits are not equivalent to a free production service.

**Impact if unavailable:** Real mobile ownership and real notification delivery cannot be verified; non-smartphone access through SMS is not operational.

**Can development continue?** Yes.

Configure approved credentials through a Git-ignored environment file or deployment secret manager. The code deliberately contains no invented credential variables for a provider that has not been chosen. Add exact variables and a live adapter only after selection; never bypass the production startup guard merely to publish simulation mode.

## Other dependencies

- **Hosting:** Owner must choose provider/account/budget and authorize production deployment. Current package runs locally; there is no cloud subscription or domain.
- **Maps & Weather:** OpenStreetMap tiles (`tile.openstreetmap.org`), Nominatim village search (`nominatim.openstreetmap.org`), and Open-Meteo forecast API (`api.open-meteo.com`) are accessed directly from the client browser with offline fallbacks. Core distance and machinery searches remain server-authoritative PostGIS. Review provider quotas, rate limits, and attribution policies prior to commercial rollout.
- **Real pilot data:** Owner supplies/authorizes real equipment data and photos. The seed uses synthetic, labeled data.
- **Business terms:** Cancellation penalties, liability/damage rules, operator acceptance rules and verification standards need owner decisions before commercial use. No default commission or automated refund exists.
- **Payments:** Excluded, including test gateways. Do not request merchant credentials. All status reports remain manually reported.
- **Pitch deck:** The current workspace contained the master prompt but not the pitch deck itself. This build follows the provided written specification and scope override; no claim is made that the deck's visual content was reviewed.
