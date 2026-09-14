(function () {
  const SUPABASE_URL = "https://zdmpzrderifgqmqivjoy.supabase.co";
  const SITE_ID = "645921ff-f33c-484f-b26d-2aa368b81f71";
  const BUCKET = "johnny-property-images";
  const FALLBACK_PROPERTIES = "./data/properties.json?v=" + Date.now();
  const FALLBACK_GALLERY = "./data/propertyData.json?v=" + Date.now();
  let catalogPromise;

  function storageUrl(path) {
    return SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + String(path || "").split("/").map(encodeURIComponent).join("/");
  }

  function remoteProperty(property, imageRows) {
    const images = (imageRows || []).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).map((image) => storageUrl(image.storage_path));
    const id = property.slug || property.id;
    const description = property.description || property.summary || "";
    return {
      id,
      name: property.title || id,
      category: property.category || "Imóvel",
      meta: description,
      price: property.price_label || "Sob consulta",
      coverImage: images[0] || "",
      gallery: images,
      whatsappMessage: property.whatsapp_message || ("Quero detalhes de: " + (property.title || id)),
      _gallery: {
        title: (property.title || id) + " - Galeria de Fotos",
        description,
        coverImage: images[0] || "",
        images
      }
    };
  }

  async function loadRemote() {
    const headers = { apikey: window.VOLYNX_SUPABASE_ANON_KEY || "" };
    const base = SUPABASE_URL + "/rest/v1/";
    const query = "?select=id,slug,title,category,summary,description,price_label,whatsapp_message&site_id=eq." + encodeURIComponent(SITE_ID) + "&status=eq.published&order=sort_order.asc,created_at.desc";
    const propertiesResponse = await fetch(base + "property_listings" + query, { headers, cache: "no-store" });
    if (!propertiesResponse.ok) throw new Error("Supabase property catalog returned " + propertiesResponse.status);
    const properties = await propertiesResponse.json();
    if (!Array.isArray(properties) || !properties.length) return null;

    const ids = properties.map((property) => property.id).join(",");
    const imagesQuery = "?select=property_id,storage_path,is_cover,sort_order&site_id=eq." + encodeURIComponent(SITE_ID) + "&property_id=in.(" + ids + ")&order=sort_order.asc";
    const imagesResponse = await fetch(base + "property_listing_images" + imagesQuery, { headers, cache: "no-store" });
    if (!imagesResponse.ok) throw new Error("Supabase property images returned " + imagesResponse.status);
    const images = await imagesResponse.json();
    const imagesByProperty = (Array.isArray(images) ? images : []).reduce((map, image) => {
      (map[image.property_id] ||= []).push(image);
      return map;
    }, {});
    const normalized = properties.map((property) => remoteProperty(property, imagesByProperty[property.id] || []));
    const propertyData = normalized.reduce((map, property) => {
      map[property.id] = property._gallery;
      return map;
    }, {});
    normalized.forEach((property) => delete property._gallery);
    return { properties: normalized, propertyData, source: "supabase" };
  }

  async function loadFallback() {
    const [propertiesResponse, galleryResponse] = await Promise.all([fetch(FALLBACK_PROPERTIES, { cache: "no-store" }), fetch(FALLBACK_GALLERY, { cache: "no-store" })]);
    if (!propertiesResponse.ok || !galleryResponse.ok) throw new Error("Could not load the local property catalog");
    const properties = await propertiesResponse.json();
    const propertyData = await galleryResponse.json();
    return { properties: Array.isArray(properties) ? properties : [], propertyData: propertyData || {}, source: "local" };
  }

  window.johnnyCatalog = {
    load: function () {
      if (!catalogPromise) {
        catalogPromise = loadRemote().catch(function (error) {
          console.warn("[johnny-catalog] Using local fallback:", error.message);
          return loadFallback();
        });
      }
      return catalogPromise;
    }
  };
}());
