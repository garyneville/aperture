# Research Brief for Aperture: Improving Photography-Optimized Weather Scoring, Confidence, and Delivery

## Atmospheric optics signals that correlate with “good light” outcomes

Forecast “cloud %” is often a blunt instrument for photography because the *visual* outcome depends on (a) where clouds sit vertically, (b) how opaque they are, (c) how inhomogeneous/broken they are, and (d) what the aerosol + humidity environment does to extinction and scattering. Sources below are chosen to support actionable proxy signals that can be derived from public NWP and satellite products.

### Vivid sunrise/sunset color: practical proxy signals beyond cloud fraction

High-level takeaway: strong dawn/dusk color is frequently a *layering + transmission* problem (optical depth and wavelength-dependent extinction) rather than simply a *cloudiness* problem. This is why “mostly cloudy” can still be spectacular (thin high ice cloud), while “partly cloudy” can be dull (thick low stratus + high aerosol extinction).

**Aerosol optical depth and haze extinction**
- Satellite AOD provides a globally consistent *optical thickness* proxy for haze: NASA’s global maps note that AOD < ~0.1 corresponds to very clear conditions while AOD approaching ~1 corresponds to very hazy conditions, which strongly affects visibility and perceived contrast. citeturn6search13  
- Classic twilight radiative-transfer work shows that aerosols (and ozone) measurably change twilight sky brightness/color through scattering/absorption in the visible spectrum—i.e., aerosols are “first-class” drivers of twilight appearance, not a second-order nuance. citeturn6search2turn6search47  
- A physically-based twilight simulation approach explicitly models altitude-varying aerosols and relative humidity, reinforcing that humidity–aerosol structure (not just cloud cover) can be decisive for twilight hues. citeturn6search12  

**Actionable scoring implications**
- Treat AOD as a *two-sided* variable for “sunset color potential”:  
  *Too low* AOD can mean very crisp but sometimes less “painted” scattering; *too high* AOD can flatten contrast and push toward a pale/orange-grey wash. NASA’s AOD scale gives you a pragmatic numeric regime to start calibrating (e.g., 0.05–0.3 vs >0.6), then fit to your local ground-truth photo outcomes. citeturn6search13  
- Combine AOD with a boundary-layer trap proxy (you already do this conceptually): when the boundary layer is shallow/stable, particulate concentrations often stay trapped, raising extinction/flattening distant contrast—this is consistent with fog/low-stratus predictability being highly sensitive to stable boundary-layer structure. citeturn13search10turn13search8  

**Humidity profiles (why humidity matters even without rain)**
- Humidity affects twilight rendering via water vapor and via aerosol microphysics (hygroscopic growth changes scattering/extinction). The twilight simulation work that includes altitude-varying humidity/aerosols is a strong “permission slip” to treat vertical RH structure as a scoring feature rather than a UI detail. citeturn6search12  
- Implementation idea: build a “haze whitening risk” feature using near-surface RH and low-level RH gradient (e.g., RH(2m), RH(925 hPa), RH(850 hPa) if available) + AOD. When humidity is high near the surface *and* AOD is moderate-high, expect more non-selective scattering and lower color separation in the skyline (more pastel, less contrasty separation). The underlying physical coupling is supported by modeling that co-varies humidity and aerosol with altitude. citeturn6search12  

**Cloud altitude and type: why thin high ice is “gold”**
- High clouds (cirrus/cirrostratus) have bases above ~20,000 ft and commonly take on sunrise/sunset colors; the Met Office explicitly describes this behavior and the ice-crystal nature of cirrus. citeturn7search0  
- Cloud altitude affects *timing* of color: clouds at different heights redden at different times relative to sunset because Earth curvature and illumination geometry matter; Hong Kong Observatory provides an explicit explanation tied to cloud height and sun position. citeturn7search11  

**Actionable scoring implications**
- Make a “high-cloud color canvas” feature: reward **partial high cloud** (thin ice cloud) near sunrise/sunset, but penalize **thick mid/low deck** that blocks the horizon light path. Met Office cloud-type descriptions support the idea that thin high cloud can act as a reflective/diffusive canvas for warm light. citeturn7search0turn7search7  
- Separate the world into at least two regimes for golden-hour scoring:  
  - **Canvas regime:** high cloud present, low cloud limited → high chance of colored cloud surfaces. citeturn7search0turn7search11  
  - **Block regime:** low/mid optically thick or fog/low stratus → warm hues suppressed, contrast collapses. The fog/low-stratus literature supports the “suppression by low cloud” framing. citeturn13search8turn12search12  

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["crepuscular rays sunset photography","cirrus clouds sunset pink","valley fog sunrise landscape photo","mammatus clouds under anvil"] ,"num_per_query":1}

### Crepuscular rays: empirically grounded conditions and forecastable proxies

Crepuscular rays (“god rays”) require (1) an occluding object (often clouds) that creates shadow beams, (2) gaps that allow direct beams, and (3) particles (aerosols/water droplets) to scatter the beams into visibility.

**Empirical/validated modeling base**
- Laboratory experiments and simulations demonstrate how crepuscular rays intensity depends on scattering and extinction through a participating medium (fog / droplets), and explicitly simulate multiple cloud configurations to produce rays. citeturn9search9  
- NASA Earth Observatory explains the operational ingredients: partial obstruction by clouds + cloud gaps + atmospheric particles (dust/aerosols/water vapor) that scatter light, with enhanced visibility at low sun angles. citeturn8search0turn8search1  
- Practitioner atmospheric optics guidance notes “true twilight rays” can be visible after sunset when the sun is up to ~4° below the horizon, tied to distant cloud banks/mountains still illuminated. citeturn8search7  

**Forecastable proxy model you can implement**
A workable “crepuscular-ray likelihood” score can be built from three multiplicative sub-scores:

- **Geometry window score:** sun elevation in the crepuscular window (include near-horizon day, civil twilight, and potentially down to ~–4° for twilight rays). citeturn8search7turn8search0  
- **Occlusion + gap score:** prefer “mostly cloudy but broken” where there are meaningful cloud gaps. In point forecasts, you often lack gap topology, so use *layered partial cloud* (e.g., mid/high fractional cloud) plus a neighborhood variability proxy (if you can sample nearby grid points). The need for cloud gaps is consistent across NASA and the Applied Optics study setup. citeturn8search0turn9search9  
- **Beam visibility score:** moderate aerosols/haze or high humidity haze, enough to scatter beams but not so opaque that extinction erases contrast (tie to AOD and low-level RH). The “particles accentuate rays” point is explicit in NASA’s explanation; the scattering/extinction dependence is explicit in laboratory/simulation work. citeturn8search0turn9search9turn6search13  

**Trade-offs**
- Purely point-based NWP cannot “see” a single dramatic gap in a cloud shelf; ray forecasting improves materially if you add a satellite nowcast layer for cloud texture/edges (see fog/low-stratus nowcasting infrastructure below). citeturn12search3turn12search12  

## Seeing, transparency, and mist: what professionals use and what you can approximate

### Astronomical seeing: how pros forecast it when there is no DIMM

Professional observatories treat seeing as an optical-turbulence problem characterized by the vertical profile of refractive-index structure parameter (C\_N²), which then yields integrated astroclimatic parameters such as seeing (ε), isoplanatic angle (θ₀), and coherence time (τ₀). Mesoscale models can simulate this with specialized turbulence parameterizations.

**State-of-practice in the literature**
- Mesoscale simulations using Meso-NH + an optical-turbulence package (Astro-Meso-NH) have been validated against turbulence profiler measurements (e.g., generalized SCIDAR), with reported performance statistics for seeing and related parameters across multi-night datasets. citeturn11search0turn11search4turn11search7  
- These works substantiate that wind and temperature profiles are primary drivers of modeled seeing and that calibration/validation against measurements is central to accuracy. citeturn11search0turn11search5  

**What “Meteoblue seeing” reveals about practical proxy variables**
Meteoblue’s public documentation is unusually explicit about operational proxy features:
- It computes “Seeing Index 1/2” based on integration of turbulent layers (i.e., not cloud cover), outputs arcsecond estimates, and highlights jet stream speed and “bad layers” tied to steep temperature gradients. citeturn10search2turn10search3  
- It notes high jet stream speeds correspond to bad seeing, and defines “bad layers” as layers with temperature gradient > 0.5 K per 100 m. citeturn10search2turn10search3  

**Actionable improvements to your current seeing proxies**
Your CAPE + wind shear approach is directionally sensible for “turbulence risk,” but it can be made closer to astronomy practice by aligning with the variables meteoblue and the optical-turbulence literature emphasize:

- **Stratification/turbulence layer proxy:** compute a “bad layer depth” metric using vertical temperature gradient thresholds if your upstream model provides temperature on pressure levels. Meteoblue’s threshold (>0.5 K/100 m) is a concrete operational rule you can adopt. citeturn10search2turn10search3  
- **Jet stream regime:** add explicit jet-level wind speed (e.g., 200–300 hPa) and penalize very high jet speeds (meteoblue cites >35 m/s as typically bad; it also notes very low speeds can correspond to bad seeing). citeturn10search2turn10search3  
- **Boundary-layer vs free-atmosphere separation:** the optical-turbulence literature routinely evaluates boundary-layer seeing vs free-atmosphere seeing. Even if you cannot compute C\_N², you can approximate this concept by splitting risk into near-surface stability + low-level wind vs upper-level shear/jet. citeturn11search0turn11search1  

**Trade-offs**
- Full seeing modeling is compute-heavy and data-hungry (vertical profiles, turbulence schemes, calibration). The pragmatic path for Aperture is to (a) keep your lightweight proxy, (b) add jet + gradient-based “bad layer” detection, and (c) calibrate against user feedback or star FWHM metadata from uploaded astro images, if you can obtain it. The existence and validation of mesoscale seeing systems supports the “calibrate to local reality” approach. citeturn11search0turn10search3  

### Fog/mist: hyperlocal prediction and a 6‑hour decision window

Fog and low stratus (FLS) are among the hardest practical forecast problems because they depend on very shallow near-surface gradients and local surface/terrain effects.

**What the research says is “state of the art”**
- A dedicated review frames fog predictability as constrained by boundary-layer processes, microphysics, land-surface coupling, and observation density, and treats nowcasting/remote sensing as central to improving short-range skill. citeturn13search8  
- Radiation fog onset in NWP is particularly sensitive to the initial boundary-layer thermodynamic structure (temperature/humidity profiles in the lowest ~1 km) and the development of shallow inversions; models often struggle with those gradients. citeturn13search10  
- Foundational numerical fog forecasting work (Monthly Weather Review) identifies sensitivity to geostrophic wind, horizontal advection, cloud cover, and soil moisture—variables that map well to the features you can extract from public models. citeturn13search7turn13search9  

**Satellite-driven nowcasting: what’s publicly available in Europe**
- Meteosat SEVIRI-based fog/low stratus detection methods achieve reported probabilities of detection and low false-alarm ratios in European evaluation, showing that satellite products can be operationally strong for FLS identification. citeturn12search12  
- Europe’s NWC SAF exists specifically to provide satellite-derived products for nowcasting and very short-range forecasting in support of NWP activities. citeturn12search3turn12search14  

**Actionable mist scoring variables for a 0–6h window**
Aperture can treat mist scoring as a *regime classifier* with a probabilistic overlay:

- **Radiation fog regime (night / early morning):** clear-sky radiative cooling + light winds + near-saturation. The literature emphasizes stable boundary layer, low winds, and clear skies as favorable conditions. citeturn13search10turn13search8  
- **Advection/sea fog regime (coasts, haar-like setups):** moist flow over cooler surface; in practice you need SST/land-sea temperature contrast and low-level wind direction/speed. Foundational fog forecasting sensitivity to advection terms supports exposing advection as a primary driver. citeturn13search9turn13search7  
- **Valley fog / cold-air pooling regime:** terrain controls (drainage flows, inversion trapping). This is where raw point NWP is weakest; you can partially compensate by terrain-aware heuristics and higher-resolution models (e.g., km-scale) that better resolve drainage flows. The fog predictability review motivates this “surface + terrain” emphasis. citeturn13search8turn12search7  

**Implementation pattern that tends to work**
- Blend NWP “fog risk” with satellite “fog present now” signals. Satellite algorithms can establish current FLS footprints; NWP can project dissipation/formation windows. NWC SAF exists to operationalize such short-range satellite support. citeturn12search3turn12search12  
- Provide *confidence flags* that explicitly warn users when the regime is terrain-driven (valley fog) where deterministic point forecasts are least trustworthy. The boundary-layer sensitivity evidence supports treating this as a first-class uncertainty source rather than a scoring bug. citeturn13search10turn13search8  

## Session-type thresholds used by practitioners, grounded in measurable variables

### Astrophotography viability: darkness, sky quality, and time windows

**Bortle class and sky darkness**
- The Bortle Dark-Sky Scale provides a widely used observational classification scheme (Class 1–9) tied to the visibility of celestial features and limiting magnitude experience; Sky & Telescope is the canonical reference in photographer practice. citeturn2search0turn2search1  
- Clear Outside surfaces an “estimated sky quality” in magnitudes and maps it to a Bortle class in its product UI, signaling that end users do respond to a single “sky darkness” number when deciding go/no-go. citeturn19search2  

**Decision thresholds you can operationalize**
Because “Bortle class viability” depends strongly on subjective goals (Milky Way core vs faint nebula), a robust approach is:
- Convert sky darkness into **tiers** (e.g., “Milky Way core friendly,” “widefield deep-sky friendly,” “only bright targets”), then allow user preferences to set the cutoff. The widespread use of Bortle classes supports tiering rather than pretending there is one universal threshold. citeturn2search0turn19search2  

**Moon and darkness windows**
- Tools like Clear Outside and The Photographer’s Ephemeris emphasize civil/nautical/astronomical darkness periods and moon rise/set/phase information as core planning primitives and show them adjacent to cloud forecasts. citeturn19search4turn17search9  
- As a practical scoring input: compute “usable dark window” as the overlap of (a) astronomical darkness and (b) moon below horizon (or moon low enough) and (c) cloud/seeing transparency. The prominence of these constructs in specialist planning tools supports their importance for decision-making. citeturn19search4turn17search9turn10search0  

### Storm photography: forecasting *photogenic* convection, not just “chance of thunder”

The most photogenic storm setups (shelf clouds, wall clouds, dramatic structure, mammatus, lightning) are not just “high CAPE.” They require an organized convective mode and sufficient shear/forcing, plus a clearing/illumination geometry that makes structure visible.

**Core forecast variables that map to storm structure**
- Deep-layer vertical wind shear (commonly 0–6 km) is used to anticipate convective archetypes (single cell vs multicell vs linear convection vs supercells). Lower-level shear and storm-relative helicity support tornado/supercell diagnostics. citeturn14search13  
- CAPE is a useful instability proxy but is neither necessary nor sufficient alone; standard meteorological guidance emphasizes that CAPE indicates potential updraft strength, with severe potential depending on “other environmental parameters.” citeturn14search0turn14search13  

**Mammatus as a “photogenic signature”**
- Mammatus is typically observed under cumulonimbus anvils; fluid-dynamical research supports physical mechanisms involving hydrometeor settling and evaporation/sublimation into subsaturated air below. This is relevant because it suggests you can score mammatus favorably when you have (a) anvil presence, (b) dry air beneath, and (c) post-convective timing. citeturn14search4  

**Actionable storm scoring logic for the UK / Northern Europe use case**
Aperture can rate “storm photography potential” using a composite:
- **Organization score:** deep-layer shear + low-level curvature proxies (from model winds). ECMWF explicitly notes CAPE–shear composites can discriminate severe vs non-severe convection, and shear helps determine convective archetype. citeturn14search13  
- **Electrical/visibility score:** precipitation intensity + cloud base/ceiling + post-frontal clearing timing. Satellite nowcasting can improve “is there structure I can see?” but even without it, “storm clearing with sun breaking through” is a classic photogenic window (supported indirectly by how astronomy tools value short clear breaks). citeturn10search0turn8search1  
- **Safety/ethics overlay:** because lightning and severe convection are dangerous, surface wind and gust proxies should gate “go” recommendations even if the storm is photogenic. (This is a product responsibility point; not a meteorological claim.)

### Long exposure seascapes and waterfalls: wind as a vibration and subject-motion problem

For long exposure, wind matters in two ways: (1) it shakes the camera system, and (2) it moves foreground elements (grass, branches, spray), changing composition viability.

**What tripod manufacturers and reviewers emphasize**
- Longer focal lengths magnify vibration; adding ballast and selecting a tripod class based on focal length are recommended to control vibration. citeturn15search1  
- Long exposure technique guidance emphasizes a solid tripod, adding weight from a ballast hook, and using remote release to avoid shake—practices that become more critical in windy coastal environments. citeturn15search3  
- Independent reviews repeatedly warn that wind-induced vibration can dominate and that minimizing center-column extension reduces vibration. citeturn15search7turn15search12  

**Actionable thresholds you can encode without pretending physics is universal**
Instead of hard “wind > X = bad,” score using a *camera-physics-aware* model that allows user inputs:
- If the user declares focal length class (wide/normal/tele) and exposure time (e.g., <1s, 1–10s, >10s), apply different wind penalties because vibration sensitivity scales with magnification and exposure duration. The “magnification reveals vibration” principle is explicitly stated by Really Right Stuff. citeturn15search1  
- Add mitigation suggestions when wind is high: lower tripod, add ballast, avoid raising center column, choose wider focal length—these reflect manufacturer/reviewer guidance. citeturn15search3turn15search7  

## Forecast confidence: communicating uncertainty and calibrating ensembles

### Best practices for uncertainty communication to non-meteorologists

The photography “should I go?” decision is a classic uncertainty-communication problem: users want a single decision cue, but the system must remain trustworthy when conditions are marginal.

- WMO guidance emphasizes uncertainty as inherent, argues that explicitly communicating uncertainty improves decision-making and can *retain user confidence*, and recommends clear definitions for probabilities and terminology. citeturn16search5  
- WMO also recommends offering “the next most likely scenario” (backup plan framing) as a way to support decisions under uncertainty—highly applicable to photography planning (e.g., “sunset color unlikely; pivot to moody urban long exposure”). citeturn16search5  

**Implementation idea for Aperture**
- Represent uncertainty in a small number of user-facing forms:  
  - a **confidence badge** (high/medium/low) derived from ensemble dispersion and model agreement  
  - a short **alternative scenario line** (“If clouds don’t break: expect flat grey; consider woodland fog instead”). This aligns with WMO’s “alternative scenario” recommendation. citeturn16search5  

### From ensemble spread to calibrated probabilities

Ensembles are typically biased and often under-dispersed; statistical post-processing is the standard corrective.

- EMOS (Ensemble Model Output Statistics) is a well-established post-processing technique that corrects bias and underdispersion while leveraging the spread–skill relationship; it produces calibrated predictive distributions and can be applied to gridded outputs. citeturn16search12turn16search0  
- Bayesian Model Averaging (BMA) is another established approach for postprocessing ensembles into a combined predictive distribution, again motivated by underdispersion and the need for calibration. citeturn16search15turn16search3  
- Meteoblue’s own API documentation explicitly frames “spread” (standard deviation across models) as a rough uncertainty indicator and notes a rule-of-thumb mapping to a ~95% interval via ±2 spread—useful as a first-pass UI mapping before you build formal calibration. citeturn10search10  

**Cloud cover is a special case**
Cloud fraction is bounded (0–100%) and often multi-modal (different cloud regimes). A practical Aperture approach:
- Start with a calibrated probability of exceeding thresholds that matter for photography (e.g., P(total cloud < 20%), P(high cloud between 20–60%)). EMOS/BMA provide the framework; you choose the event definition and distributional family. citeturn16search12turn16search15  
- Use a reliability diagram/backtesting loop on your own logged forecasts vs observed cloud (satellite or station observations), consistent with the broader calibration motivation in EMOS/BMA. citeturn16search12turn16search15  

### Modeling disagreement as a UX feature, not a bug

Windy community threads show recurring user confusion: one model says ~0% cloud while reality is overcast; moderators recommend comparing models and highlight that model choice matters, especially for cloud and fog. citeturn18search3turn18search7  

**Actionable product pattern**
- When models diverge, show a short “model disagreement” callout and suggest the two best-performing models for the region (based on your own backtests), instead of only showing a standard deviation number. The user confusion about “which model to pay attention to” is explicit in community discussions. citeturn18search3turn18search7  

## Competitive landscape: what photographers actually use and what they complain about

This section focuses on what can be substantiated from primary product descriptions and user discussions found during research, with emphasis on decision workflows rather than branding.

### Clear Outside, Astrospheric, Windy, meteoblue, and The Photographer’s Ephemeris as “planning primitives”

**Clear Outside**
- Clear Outside positions itself as “7‑day hourly cloud & weather forecasts” designed for astronomers, with low/medium/high/total cloud breakdown, darkness periods, moon information, ISS passovers, and a red–amber–green indicator UX. citeturn19search2turn19search4  
- It also surfaces an estimated sky quality value and a Bortle class mapping, which suggests end users value a single “darkness/sky quality” scalar. citeturn19search2  

**Astrospheric**
- Astrospheric markets “sky data” (cloud, transparency, seeing) and includes an ensemble cloud forecast (in a paid tier) and even smoke integrated into transparency. citeturn17search3turn17search5  
- This validates Aperture’s direction of treating aerosols/smoke as “photography-relevant,” not merely health-relevant. citeturn17search3turn6search13  

**meteoblue**
- meteoblue’s astronomy seeing product explicitly separates cloud-cover layers and turbulence-derived seeing indices; it highlights jet stream and temperature-gradient “bad layers” as practical interpretation aids. citeturn10search2turn10search3  
- meteoblue also documents that it combines multiple data sources and uses post-processing (including downscaling/statistics/ML and nowcasting); it explicitly states it merges satellite data and uses it for cloud nowcasting. citeturn19search3turn19search10  

**Windy**
- Windy’s own store description emphasizes multi-model access (including ECMWF/GFS/ICON and high-resolution regional models in Europe), many map layers including CAPE, plus satellite composites and radar—supporting the “exploratory weather map” workflow photographers often use. citeturn18search15turn18search14  
- Complaints and support replies in Windy’s community show a persistent theme: users interpret model forecast fields as “the truth,” then get frustrated when fog/cloud/visibility differ; moderators stress that Windy visualizes model forecasts and that comparing models is necessary. citeturn18search7turn18search3  
- Third-party review aggregation (Trustpilot) shows polarized sentiment: some users praise model selection and trip planning, others complain about inaccuracies and UX issues. Treat this as qualitative signal, not truth about forecast skill. citeturn18search5  

**The Photographer’s Ephemeris**
- TPE is an explicitly light-centric planning tool: sun/moon/night photography planning with map-based visualization; it cites established astronomical and geodetic algorithm sources in its documentation. citeturn17search9turn17search10  

### What these tools do well that maps directly to Aperture

Across these tools, several consistent “decision primitives” emerge:
- **Layered cloud (low/mid/high)** rather than a single cloud % (Clear Outside, meteoblue). citeturn19search4turn10search2  
- **Time-window emphasis** (hourly) with quick “is it worth going out?” cues (Clear Outside traffic lights). citeturn19search4turn19search2  
- **Model comparison** for confidence (Windy; Astrospheric ensemble cloud). citeturn18search3turn17search3  
- **Augmenting with satellite/radar** for reality checks and nowcasting (Windy store description; meteoblue satellite/radar provider docs). citeturn18search15turn19search10  

Aperture’s scoring + editorial approach can differentiate by turning these primitives into *photography-specific* session scoring rather than requiring users to mentally translate raw variables.

## AI editorial: avoiding formulaic briefings and validating factual consistency

### What weather NLG systems learned before LLMs

The SumTime family of systems is directly relevant because it tackled exactly the “daily briefing becomes repetitive” and “numeric-to-language mapping varies by writer” problems.

- SUMTIME-MOUSAM produced marine weather forecast text from NWP data and was deployed operationally to generate ~150 draft forecasts per day that were post-edited by forecasters—evidence that “draft + human-like polish” can scale if your I/O contracts are stable. citeturn20search2  
- Research on lexical choice in generated weather forecasts found major variation among human forecasters in mapping numbers to words; SumTime deliberately used consistent data-to-word rules and user evaluation suggested preference for the system’s consistency in some cases. citeturn20search5turn20search7  
- A later case study explicitly frames NLG meeting the weather industry’s demand for high quantity and high quality text, involving Arria NLG and the Met Office; it reports generating large volumes of site-specific texts quickly. citeturn20search50  

**Actionable prompting/content strategies you can port to an LLM-era system**
- **Separate content selection from surface realization.** SumTime’s success depended on choosing what to say (signal extraction) and *then* choosing wording. Architecturally, this implies: compute a small set of “facts + deltas + risks” per hour/session, then let the LLM realize text within constraints. citeturn20search2turn20search5  
- **Stabilize numeric-to-word mappings using a controlled phrasebook** for thresholds (“light winds,” “breezy,” “gale risk”) and let the model vary only optional stylistic flourishes. The need for consistent word choice is a core conclusion of the lexical-choice work. citeturn20search5  
- **Rotate narrative frames** (e.g., “plan A / plan B,” “risk-first,” “opportunity-first”) rather than rotating adjectives. WMO’s recommendation to include alternative scenarios dovetails with this, and can be implemented as editorial “templates” chosen by spread/confidence and user preference. citeturn16search5turn20search5  

### Factual consistency validation beyond basic checks

Your current “consistency checks” can be made more robust by borrowing evaluation/verification methods from summarization research, adapting them to structured-data-to-text.

- QAGS evaluates factual consistency by generating questions from a summary and comparing answers from the summary vs the source; it is designed to catch inconsistencies that surface-level metrics miss. citeturn21search1turn21search2  
- FactCC provides a framework and dataset for factual consistency verification of abstractive summaries and releases trained models/code, illustrating a practical “classifier-based” approach to detecting inconsistencies. citeturn21search13  

**Implementation ideas for Aperture**
- **Claim extraction → structured verification:** extract atomic claims from the generated editorial (e.g., “High cloud will break around 19:00,” “Wind gusts peak at 28 mph”), map each to a JSONPath + comparator against your structured forecast, and fail/regen if mismatched. QAGS supports the value of question/answer-style checking when text and data can drift. citeturn21search1turn21search2  
- **Use a second model as a “verification agent,”** but constrain it to evidence from the structured forecast. The broader literature shows LLMs and auxiliary models can be used as evaluators; FactCC and QAGS demonstrate the general effectiveness of dedicated factuality evaluation pipelines. citeturn21search13turn21search1  

## Data sources and scaling: where to get higher-value signals than raw hourly forecasts

### Higher-resolution and specialized data sources relevant to photography outcomes

**Aerosols and clarity**
- MODIS-based AOD products (e.g., NASA global maps) provide a direct optical proxy for haze/clarity, which is valuable for both golden-hour color and astrophotography transparency scoring. citeturn6search13turn6search2  

**Satellite nowcasting infrastructure**
- EUMETSAT’s NWC SAF exists specifically to generate satellite-derived products for nowcasting and very short range forecasting, and its outputs are used operationally by meteorological agencies. This is the most direct route to adding “what’s happening now” cloud/fog intelligence to an automated photography briefing in Europe. citeturn12search3turn12search14  
- The SEVIRI-based fog/low stratus detection literature demonstrates that robust, validated low-cloud products can be produced from geostationary imagery over Europe. citeturn12search12  

**Multi-source fusion patterns from commercial providers**
- meteoblue documents that it combines simulation, observations, measurements, and post-processing (including nowcasting and ML) for accuracy, and lists its satellite providers and use of satellite data for cloud nowcasting. This is a practical benchmark for the kind of fusion Aperture may eventually implement, even if you stay “open data first.” citeturn19search3turn19search10  

### Model resolution and the UK / Northern Europe problem

In maritime climates, small shifts in wind direction, boundary-layer stability, and topographic forcing can dramatically change fog/low cloud and break timing.

- The Met Office describes a deterministic UK forecast configuration with a high-resolution inner domain (~1.5 km grid boxes) over the UK and Ireland, nested in coarser domains—exactly the kind of model resolution that tends to matter for fog, convection initiation, and coastal effects. citeturn12search1turn12search7  
- Research-grade models like Meso-NH explicitly support simulation across scales and phenomena including storms, lightning, and fog, underscoring the scientific basis for “resolution + appropriate physics” as the long-term path to better hyperlocal scoring. citeturn11search3turn11search8  

### Open-Meteo usage constraints and batching/caching

Open-Meteo’s free tier is governed by fair-use/rate-limiting policies that can change over time; implement caching and geographic batching as first-class design constraints, and treat “multi-location scoring” as an algorithmic problem (schedule, throttle, reuse) rather than only an infra scaling problem. citeturn4search0turn4search1turn4search2  

A practical approach aligned with the uncertainty research:
- Cache responses at the raw forecast level (by model run time + location + variable set), and derive all session scores from cached raws. This reduces repeated calls and improves reproducibility for calibration/backtesting. The importance of stable I/O interfaces is explicitly noted as a major maintenance issue in deployed NLG systems. citeturn20search2turn4search0