export namespace models {
	
	export class ColumnInfo {
	    name: string;
	    type: string;
	    length: number;
	    nullable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ColumnInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.length = source["length"];
	        this.nullable = source["nullable"];
	    }
	}
	export class ConnectionConfig {
	    id: string;
	    name: string;
	    host: string;
	    port: number;
	    serviceName: string;
	    sid: string;
	    username: string;
	    password: string;
	    role: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.serviceName = source["serviceName"];
	        this.sid = source["sid"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.role = source["role"];
	    }
	}
	export class QueryResult {
	    columns: ColumnInfo[];
	    rows: any[][];
	    rowCount: number;
	    execTimeMs: number;
	    messages: string[];
	    hasMore: boolean;
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = this.convertValues(source["columns"], ColumnInfo);
	        this.rows = source["rows"];
	        this.rowCount = source["rowCount"];
	        this.execTimeMs = source["execTimeMs"];
	        this.messages = source["messages"];
	        this.hasMore = source["hasMore"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

