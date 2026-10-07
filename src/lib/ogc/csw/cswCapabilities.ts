// cswCapabilitiesFull.ts
export interface ICSWCapabilities {
  version: string;
  serviceIdentification: ServiceIdentification;
  serviceProvider: ServiceProvider;
  operationsMetadata: OperationsMetadata;
  filterCapabilities: FilterCapabilities;
}

export interface ServiceIdentification {
  title: string;
  abstract: string;
  keywords: Keyword[];
  serviceType: string;
  serviceTypeVersion: string;
  fees?: string;
  accessConstraints?: string;
}

export interface Keyword {
  value: string;
  type?: string;
}

export interface ServiceProvider {
  providerName?: string;
  providerSite?: string;
  serviceContact: ServiceContact;
}

export interface ServiceContact {
  individualName?: string;
  positionName?: string;
  contactInfo: ContactInfo;
  role?: string;
}

export interface ContactInfo {
  phone?: Phone;
  address?: Address;
  hoursOfService?: string;
  contactInstructions?: string;
}

export interface Phone {
  voice?: string;
  facsimile?: string;
}

export interface Address {
  deliveryPoint?: string;
  city?: string;
  administrativeArea?: string;
  postalCode?: string;
  country?: string;
  electronicMailAddress?: string;
}

export interface OperationsMetadata {
  operations: Operation[];
  parameters?: Parameter[];
  constraints?: Constraint[];
}

export interface Operation {
  name: string;
  dcp: DCP;
  parameters: Parameter[];
  constraints: Constraint[];
}

export interface DCP {
  http: HTTP;
}

export interface HTTP {
  get?: string;
  post?: string;
}

export interface Parameter {
  name: string;
  values: string[];
}

export interface Constraint {
  name: string;
  values: string[];
}

export interface FilterCapabilities {
  spatialCapabilities: SpatialCapabilities;
  scalarCapabilities: ScalarCapabilities;
  idCapabilities: IdCapabilities;
}

export interface SpatialCapabilities {
  geometryOperands: string[];
  spatialOperators: string[];
}

export interface ScalarCapabilities {
  logicalOperators?: string[];
  comparisonOperators: string[];
}

export interface IdCapabilities {
  eid?: string;
  fid?: string;
}

// ----------------------------
// Função para parsear o XML
// ----------------------------
export function parseCSWCapabilities(xmlString: string): ICSWCapabilities {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, "application/xml");

  const getText = (el: Element | null) => el?.textContent?.trim() ?? "";
  const getAttr = (el: Element | null, attr: string) => el?.getAttribute(attr) ?? undefined;

  // version do CSW
  const cswRoot = xml.documentElement;
  const version = getAttr(cswRoot, "version") ?? "";

  // ServiceIdentification
  const siEl = xml.querySelector("ows\\:ServiceIdentification, ServiceIdentification");
  const keywords = Array.from(siEl?.querySelectorAll("ows\\:Keywords > ows\\:Keyword, Keywords > Keyword") ?? []).map(el => ({
    value: getText(el),
    type: getText(el.parentElement?.querySelector("ows\\:Type, Type")) || undefined
  }));

  const serviceIdentification: ServiceIdentification = {
    title: getText(siEl?.querySelector("ows\\:Title, Title")),
    abstract: getText(siEl?.querySelector("ows\\:Abstract, Abstract")),
    keywords,
    serviceType: getText(siEl?.querySelector("ows\\:ServiceType, ServiceType")),
    serviceTypeVersion: getText(siEl?.querySelector("ows\\:ServiceTypeVersion, ServiceTypeVersion")),
    fees: getText(siEl?.querySelector("ows\\:Fees, Fees")),
    accessConstraints: getText(siEl?.querySelector("ows\\:AccessConstraints, AccessConstraints")),
  };

  // ServiceProvider
  const spEl = xml.querySelector("ows\\:ServiceProvider, ServiceProvider");
  const serviceProvider: ServiceProvider = {
    providerName: getText(spEl?.querySelector("ows\\:ProviderName, ProviderName")),
    providerSite: getAttr(spEl?.querySelector("ows\\:ProviderSite, ProviderSite"), "xlink:href"),
    serviceContact: {
      individualName: getText(spEl?.querySelector("ows\\:ServiceContact > ows\\:IndividualName, ServiceContact > IndividualName")),
      positionName: getText(spEl?.querySelector("ows\\:ServiceContact > ows\\:PositionName, ServiceContact > PositionName")),
      contactInfo: {
        phone: {
          voice: getText(spEl?.querySelector("ows\\:Phone > ows\\:Voice, Phone > Voice")),
          facsimile: getText(spEl?.querySelector("ows\\:Phone > ows\\:Facsimile, Phone > Facsimile")),
        },
        address: {
          deliveryPoint: getText(spEl?.querySelector("ows\\:Address > ows\\:DeliveryPoint, Address > DeliveryPoint")),
          city: getText(spEl?.querySelector("ows\\:Address > ows\\:City, Address > City")),
          administrativeArea: getText(spEl?.querySelector("ows\\:Address > ows\\:AdministrativeArea, Address > AdministrativeArea")),
          postalCode: getText(spEl?.querySelector("ows\\:Address > ows\\:PostalCode, Address > PostalCode")),
          country: getText(spEl?.querySelector("ows\\:Address > ows\\:Country, Address > Country")),
          electronicMailAddress: getText(spEl?.querySelector("ows\\:Address > ows\\:ElectronicMailAddress, Address > ElectronicMailAddress"))
        },
        hoursOfService: getText(spEl?.querySelector("ows\\:HoursOfService, HoursOfService")),
        contactInstructions: getText(spEl?.querySelector("ows\\:ContactInstructions, ContactInstructions"))
      },
      role: getText(spEl?.querySelector("ows\\:Role, Role"))
    }
  };

  // FilterCapabilities
  const fcEl = xml.querySelector("ogc\\:Filter_Capabilities, Filter_Capabilities");
  const filterCapabilities: FilterCapabilities = {
    spatialCapabilities: {
      geometryOperands: Array.from(fcEl?.querySelectorAll("ogc\\:GeometryOperands > ogc\\:GeometryOperand, GeometryOperands > GeometryOperand") ?? []).map(getText),
      spatialOperators: Array.from(fcEl?.querySelectorAll("ogc\\:SpatialOperators > ogc\\:SpatialOperator, SpatialOperators > SpatialOperator") ?? []).map(el => getAttr(el, "name") ?? "")
    },
    scalarCapabilities: {
      logicalOperators: [], // vazio pois não há detalhes
      comparisonOperators: Array.from(fcEl?.querySelectorAll("ogc\\:ComparisonOperators > ogc\\:ComparisonOperator, ComparisonOperators > ComparisonOperator") ?? []).map(getText)
    },
    idCapabilities: {
      eid: getText(fcEl?.querySelector("ogc\\:Id_Capabilities > ogc\\:EID, Id_Capabilities > EID")),
      fid: getText(fcEl?.querySelector("ogc\\:Id_Capabilities > ogc\\:FID, Id_Capabilities > FID"))
    }
  };

  // OperationsMetadata
  const opsEl = xml.querySelector("ows\\:OperationsMetadata, OperationsMetadata");
  const operations: Operation[] = Array.from(opsEl?.querySelectorAll("ows\\:Operation, Operation") ?? []).map(opEl => ({
    name: getAttr(opEl, "name") ?? "",
    dcp: {
      http: {
        get: getAttr(opEl.querySelector("ows\\:DCP > ows\\:HTTP > ows\\:Get, DCP > HTTP > Get"), "xlink:href"),
        post: getAttr(opEl.querySelector("ows\\:DCP > ows\\:HTTP > ows\\:Post, DCP > HTTP > Post"), "xlink:href"),
      }
    },
    parameters: Array.from(opEl.querySelectorAll("ows\\:Parameter, Parameter")).map(pEl => ({
      name: getAttr(pEl, "name") ?? "",
      values: Array.from(pEl.querySelectorAll("ows\\:Value, Value")).map(getText)
    })),
    constraints: Array.from(opEl.querySelectorAll("ows\\:Constraint, Constraint")).map(cEl => ({
      name: getAttr(cEl, "name") ?? "",
      values: Array.from(cEl.querySelectorAll("ows\\:Value, Value")).map(getText)
    }))
  }));

  const operationsMetadata: OperationsMetadata = { operations };

  return {
    version,
    serviceIdentification,
    serviceProvider,
    operationsMetadata,
    filterCapabilities
  };
}
